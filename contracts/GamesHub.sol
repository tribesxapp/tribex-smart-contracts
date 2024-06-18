// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IGamesHub.sol";

contract GamesHub is AccessControl, IGamesHub {
    //// Constants ////
    // Roles
    bytes32 public constant override ADMIN_ROLE = keccak256("ADMIN");
    bytes32 public constant override DEV_ROLE = keccak256("DEV");
    bytes32 public constant override GAME_CONTRACT = keccak256("GAME");

    // Contracts
    bytes32 public constant override NFT_POOL = keccak256("NFT_POOL");
    bytes32 public constant override CREDIT_POOL = keccak256("CREDIT_POOL");

    //// Variables ////
    mapping(bytes32 => address) public override games;
    mapping(bytes32 => address) public override helpers;
    mapping(address => PlayerRanking) private _playerRanking;
    uint256 public override nonce;

    address public override adminWallet;

    constructor() {
        _grantRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(DEV_ROLE, ADMIN_ROLE);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        adminWallet = msg.sender;
    }

    /**
     * @dev Throws if called by any account other than project contracts.
     */
    modifier onlyProject() {
        require(
            hasRole(GAME_CONTRACT, msg.sender) ||
                hasRole(ADMIN_ROLE, msg.sender),
            "GH-01"
        );
        _;
    }

    //// Mutators ////

    /**
     * @dev Set the admin wallet address
     * @param _adminWallet Address of the admin wallet
     */
    function setAdminWallet(address _adminWallet) public onlyProject {
        adminWallet = _adminWallet;
        emit SetAdminWallet(_adminWallet);
    }

    /**
     * @dev Set the game contract address
     * @param _contract Address of the contract
     * @param _name Name of the contract
     * @param _isHelper Is the contract a helper? If false, it's a game contract
     */
    function setGameContact(
        address _contract,
        bytes32 _name,
        bool _isHelper
    ) public onlyProject {
        if (_name != keccak256("")) {
            if (!_isHelper) games[_name] = _contract;
            else helpers[_name] = _contract;
        }
        _grantRole(GAME_CONTRACT, _contract);
        emit GameContractSet(_contract, _name);
    }

    /**
     * @dev Remove the game contract address
     * @param _contract Address of the contract
     * @param _name Name of the contract
     * @param _isHelper Is the contract a helper? If false, it's a game contract
     */
    function removeGameContact(
        address _contract,
        bytes32 _name,
        bool _isHelper
    ) public onlyProject {
        _revokeRole(GAME_CONTRACT, _contract);
        if (_name != keccak256("")) {
            if (!_isHelper) delete games[_name];
            else delete helpers[_name];
        }
        emit GameContractRemoved(_contract, _name);
    }

    /**
     * @dev Execute a call to a contract
     * @param gameName Name of the contract
     * @param data Data to send to the contract
     * @param isHelper Is the contract a helper? If false, it's a game contract
     * @param sendSender Should the sender be sent to the contract?
     * @return bytes Return data from the contract
     */
    function executeCall(
        bytes32 gameName,
        bytes memory data,
        bool isHelper,
        bool sendSender
    ) public returns (bytes memory) {
        address projectContract = isHelper
            ? helpers[gameName]
            : games[gameName];
        require(projectContract != address(0), "GH-02");

        if (sendSender) {
            // Step 1: Extract the function signature (first 4 bytes)
            bytes4 functionSignature;
            assembly {
                functionSignature := mload(add(data, 32))
            }

            // Step 2: Create new payload with msg.sender
            data = abi.encodePacked(data, msg.sender);

            // Replace first 4 bytes with the original function signature
            assembly {
                mstore(add(data, 32), functionSignature)
            }
        }

        // Step 3: Execute the call with the modified payload
        (bool success, bytes memory returnData) = projectContract.call(
            data
        );
        require(success, "GH-03");
        emit ExecutedCall(gameName, data, returnData);
        return (returnData);
    }

    /**
     * @dev Change the player ranking
     * @param player Address of the player
     * @param game Name of the game
     * @param volumeIn Volume in
     * @param volumeOut Volume out
     * @param win Did the player win?
     * @param loss Did the player lose?
     */
    function changePlayerRanking(
        address player,
        bytes32 game,
        uint256 volumeIn,
        uint256 volumeOut,
        bool win,
        bool loss
    ) public onlyProject {
        PlayerRanking storage ranking = _playerRanking[player];
        ranking.game = game;
        ranking.volumeIn = ranking.volumeIn + volumeIn;
        ranking.volumeOut = ranking.volumeOut + volumeOut;
        ranking.wins = win ? ranking.wins + 1 : ranking.wins;
        ranking.losses = loss ? ranking.losses + 1 : ranking.losses;

        emit PlayerRankingChanged(
            player,
            game,
            volumeIn,
            volumeOut,
            win,
            loss
        );
    }

    /**
     * @dev Increment the nonce
     */
    function incrementNonce() public onlyProject {
        nonce += 1;

        emit NonceIncremented(nonce);
    }

    //// Getters ////

    /**
     * @dev Retrieve the creditPool contract address
     */
    function getCreditPool() public view returns (address) {
        return games[CREDIT_POOL];
    }

    /**
     * @dev Retrieve the nftPool contract address
     */
    function getNFTPool() public view returns (address) {
        return games[NFT_POOL];
    }

    /**
     * @dev Retrieve the current block timestamp
     * @return uint256 Current block timestamp
     */
    function retrieveTimestamp() public view returns (uint256) {
        return block.timestamp;
    }

    /**
     * @dev Returns `true` if `account` has been granted `role`.
     */
    function checkRole(
        bytes32 role,
        address account
    ) public view virtual override returns (bool) {
        return hasRole(role, account);
    }

    /**
     * @dev Retrieve the player ranking
     * @param player Address of the player
     * @return bytes32 Name of the game
     * @return uint256 Volume in
     * @return uint256 Volume out
     * @return uint256 Wins
     * @return uint256 Losses
     */
    function playerRanking(
        address player
    ) public view override returns (bytes32, uint256, uint256, uint256, uint256) {
        PlayerRanking memory ranking = _playerRanking[player];
        return (
            ranking.game,
            ranking.volumeIn,
            ranking.volumeOut,
            ranking.wins,
            ranking.losses
        );
    }
}
