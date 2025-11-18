const { keccak256 } = require("ethereum-cryptography/keccak");
const { secp256k1 } = require("ethereum-cryptography/secp256k1");
const { toHex, utf8ToBytes } = require("ethereum-cryptography/utils");

const express = require("express");
const app = express();
const cors = require("cors");
const port = 3042;

app.use(cors());
app.use(express.json());

const balances = {
  "602d3e0912e7b86932724915bc50d216313e9105086534fc749a5cb220a6b0ff": 100,
  "cd398f1a6c42d1e59ba2d3dae2ac393d3fabade34149c836d90ac64a994270ca": 50,
  "b2fd2bb8a6ee54c341231657ad141b36577db624df3b6df3b4d193535ca831e9": 75,
};

app.get("/balance/:address", (req, res) => {
  const { address } = req.params;
  const balance = balances[address] || 0;
  res.send({ balance });
});

app.post("/send", (req, res) => {
  const transaction = req.body;
  console.log("Received transaction:", transaction);
  
  const { sender, recipient, amount, signature, recoveryBit } = transaction;
  
  // Проверяем наличие всех полей
  if (!sender || !recipient || !amount || !signature || recoveryBit === undefined) {
    return res.status(400).send({ message: "Missing transaction fields" });
  }

  // Создаем хеш всех полей транзакции
  const message = JSON.stringify({ sender, amount, recipient });
  const messageHash = keccak256(utf8ToBytes(message));
  
  try {
    // Конвертируем подпись из hex в Uint8Array
    const signatureBytes = hexToBytes(signature);
    
    // Восстанавливаем публичный ключ
    const publicKey = secp256k1.recoverPublicKey(messageHash, signatureBytes, recoveryBit);
    const senderAddress = toHex(publicKey);
    
    // Проверяем подпись и соответствие отправителя
    const isSigned = secp256k1.verify(signatureBytes, messageHash, publicKey);
    const isSenderValid = senderAddress === sender;

    if (!isSigned || !isSenderValid) {
      return res.status(400).send({ message: "Invalid signature or sender mismatch" });
    }

    // Обрабатываем транзакцию
    setInitialBalance(sender);
    setInitialBalance(recipient);

    if (balances[sender] < amount) {
      return res.status(400).send({ message: "Not enough funds!" });
    }

    balances[sender] -= amount;
    balances[recipient] += amount;
    res.send({ balance: balances[sender] });

  } catch (error) {
    console.error("Transaction error:", error);
    res.status(400).send({ message: "Error processing transaction" });
  }
});

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function setInitialBalance(address) {
  if (!balances[address]) {
    balances[address] = 0;
  }
}

app.listen(port, () => {
  console.log(`Listening on port ${port}!`);
});