const fs = require("fs-extra");
const path = require('path');

const contractsBuildDir = path.join(__dirname, '..', 'build', 'contracts');
const abiDir = path.join(__dirname, '..', 'abi');

// Cria a pasta /abi se ela não existir
if (!fs.existsSync(abiDir)) {
  fs.mkdirSync(abiDir);
}

// Lê todos os arquivos na pasta /build/contracts
fs.readdirSync(contractsBuildDir).forEach(file => {
  if (file.endsWith('.json')) {
    const contractJson = require(path.join(contractsBuildDir, file));
    const abi = contractJson.abi;
    const abiFileName = path.join(abiDir, file);

    // Salva o ABI em um novo arquivo na pasta /abi
    fs.writeFileSync(abiFileName, JSON.stringify(abi, null, 2));
  }
});

console.log("ABIs extraídos com sucesso.");
