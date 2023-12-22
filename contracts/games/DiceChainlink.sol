// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/vrf/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import "../interfaces/IGamesHub.sol";
import "../interfaces/IERC20.sol";

contract DiceChainlink is VRFConsumerBaseV2, ConfirmedOwner {
    event DiceRolled(
        address indexed player,
        uint256 indexed nonce,
        uint256 indexed rngNonce,
        uint256 creditAmount
    );
    event GameFinished(
        uint256 indexed nonce,
        address indexed player,
        uint256 volumeIn,
        uint256 volumeOut,
        uint8 result,
        uint256 randomness,
        uint8 diceResult
    );
    event LimitsAndChancesChanged(
        uint256 maxLimit,
        uint256 minLimit,
        bool limitTypeFixed,
        uint8 feeFromBet,
        uint8 feePercFromWin
    );
    event GameRefunded(
        uint256 indexed nonce,
        address indexed player,
        uint256 volume
    );

    IGamesHub public gamesHub;
    IERC20 public token;
    uint256 public totalBet;
    uint256 public maxLimit = 1000 * (10 ** 6); //default 1000 USDC
    uint256 public minLimit = 1 * (10 ** 6); //default 1 USDC
    uint256 public feeFromBet = 7 * (10 ** 4); //default 7 cents
    uint8 public feePercFromWin = 15;
    bool limitTypeFixed = true;
    uint256 totalGames = 0;

    struct Games {
        address player;
        uint256 amount;
        uint8[5] bet;
        mapping(uint8 => bool) sides; // true if the side is bet
        uint8 sizeBet; // number of sides bet
        uint8 result; // 0- not set, 1- win, 2- lose, 3- refunded
    }
    mapping(uint256 => Games) public games;

    VRFCoordinatorV2Interface COORDINATOR;

    // Chainlink subscription data struct, with the same subscription ID type as the VRF Coordinator
    uint64 s_subscriptionId;
    bytes32 keyHash;
    uint32 callbackGasLimit;
    uint16 requestConfirmations;

    mapping(uint256 => uint256) gameNonce;

    constructor(
        uint64 subscriptionId,
        address vrfCoordinator,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations,
        address _gamesHub
    ) VRFConsumerBaseV2(vrfCoordinator) ConfirmedOwner(msg.sender) {
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
        s_subscriptionId = subscriptionId;
        keyHash = _keyHash;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;
        gamesHub = IGamesHub(_gamesHub);
        token = IERC20(gamesHub.helpers(keccak256("TOKEN")));
        totalBet = 0;
    }

    /**
     * @dev Roll the dice, sending the numbers from 1 to 6
     * Repeated numbers will be ignored
     * @param _sides Array of 5 sides to bet on (numbers 1 to 6, 0 if side not chosen)
     * @param _amount Amount of tokens to bet
     */
    function rollDice(uint8[5] memory _sides, uint256 _amount) external {
        uint256 balance = token.balanceOf(address(this));

        if (limitTypeFixed) {
            require(_amount <= maxLimit && _amount >= minLimit, "DC-01");
        } else {
            require(
                _amount <= (maxLimit * balance) / 100 &&
                    _amount >= (minLimit * balance) / 100,
                "DC-01"
            );
        }

        require(balance >= ((totalBet + _amount) * 6), "DC-02");

        gamesHub.incrementNonce();

        for (uint8 i = 0; i < 5; i++) {
            if (
                _sides[i] > 0 &&
                _sides[i] < 7 &&
                !games[gamesHub.nonce()].sides[_sides[i]]
            ) {
                games[gamesHub.nonce()].sides[_sides[i]] = true;
                games[gamesHub.nonce()].sizeBet += 1;
            }
        }

        require(games[gamesHub.nonce()].sizeBet > 0, "DC-09");

        _amount -= feeFromBet;

        token.transferFrom(msg.sender, address(this), _amount);
        // Sending fee to the house
        token.transferFrom(
            msg.sender,
            gamesHub.helpers(keccak256("TREASURY")),
            feeFromBet
        );

        games[gamesHub.nonce()].player = msg.sender;
        games[gamesHub.nonce()].amount = _amount;
        games[gamesHub.nonce()].bet = _sides;

        uint256 nonce = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            1
        );
        gameNonce[nonce] = gamesHub.nonce();

        totalBet += _amount;
        totalGames += 1;
        emit DiceRolled(msg.sender, gamesHub.nonce(), nonce, _amount);
    }

    /**
     * @dev Callback function from the Chainlink VRF Coordinator
     * It will determine if the player won or lost and send the tokens to the player if he won
     * @param _requestId Request ID of the random number
     * @param _randomWords Random number
     */
    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal override {
        Games storage game = games[gameNonce[_requestId]];
        if (game.result > 0) return;

        uint256 volume = 0;
        uint8 diceResult = uint8((_randomWords[0] % 6)) + 1;

        if (game.sides[diceResult]) {
            game.result = 1;
            
            volume = (game.amount * 6) / game.sizeBet;
            uint256 _fee = ((volume - game.amount) * feePercFromWin) / 1000;

            volume -= _fee;
            token.transfer(game.player, volume);
            // token.transfer(gamesHub.helpers(keccak256("TREASURY")), _fee);
        } else {
            game.result = 2;
        }
        totalBet -= game.amount;

        emit GameFinished(
            gameNonce[_requestId],
            game.player,
            game.amount,
            volume,
            game.result,
            _randomWords[0],
            diceResult
        );
    }

    /**
     * @dev Refund the game to the player. To use only if some game is stuck.
     * @param _nonce Nonce of the game
     */
    function refundGame(uint256 _nonce) external {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "DC-05");
        Games storage game = games[_nonce];
        require(game.result == 0, "DC-04");

        token.transfer(game.player, game.amount);
        totalBet -= game.amount;
        game.result = 3;

        emit GameRefunded(_nonce, game.player, game.amount);
    }

    /**
     * @dev Change the house chance and bet limit
     * @param _maxLimit maximum bet limit
     * @param _minLimit minimum bet limit
     * @param _limitTypeFixed if true, the bet limit will be fixed, if false, the bet limit will be a percentage of the contract balance
     * @param _feeFromBet fee from the bet
     * @param _feePercFromWin fee percentage from the win
     */
    function changeLimitsAndChances(
        uint256 _maxLimit,
        uint256 _minLimit,
        bool _limitTypeFixed,
        uint8 _feeFromBet,
        uint8 _feePercFromWin
    ) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "DC-05");
        require(_maxLimit >= _minLimit, "DC-06");
        require(_feePercFromWin <= 500, "DC-08");

        if (!limitTypeFixed) {
            require(_maxLimit <= 100 && _minLimit <= 100, "DC-12");
        }

        maxLimit = _maxLimit;
        minLimit = _minLimit;
        limitTypeFixed = _limitTypeFixed;
        feeFromBet = _feeFromBet;
        feePercFromWin = _feePercFromWin;

        emit LimitsAndChancesChanged(
            _minLimit,
            _maxLimit,
            _limitTypeFixed,
            _feeFromBet,
            _feePercFromWin
        );
    }

    /**
     * @dev Change the token address, sending the current token balance to the admin wallet
     * @param _token New token address
     */
    function changeToken(address _token) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "DC-05");
        require(totalBet == 0, "DC-07");

        token.transfer(gamesHub.adminWallet(), token.balanceOf(address(this)));
        token = IERC20(_token);
    }

    /**
     * @dev Change the key hash for the gwei price on chainlink
     * @param _keyHash New key hash
     */
    function changeKeyHash(bytes32 _keyHash) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "DC-05");
        keyHash = _keyHash;
    }

    /**
     * @dev Withdraw tokens from the contract to the admin wallet
     * @param _amount Amount of tokens to withdraw
     */
    function withdrawTokens(uint256 _amount) public {
        require(gamesHub.checkRole(gamesHub.ADMIN_ROLE(), msg.sender), "DC-05");
        require(totalBet == 0, "DC-07");

        token.transfer(gamesHub.adminWallet(), _amount);
    }
}
