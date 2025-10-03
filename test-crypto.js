const { createPublicKey, createPrivateKey, publicEncrypt, privateDecrypt } = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Test script to verify RSA encryption/decryption works
 */
function testEncryptDecrypt() {
  console.log('🧪 Testing RSA encryption/decryption...');

  const keysDir = path.join(__dirname, 'keys');
  const publicKeyPath = path.join(keysDir, 'public.pem');
  const privateKeyPath = path.join(keysDir, 'private.pem');

  // Check if keys exist
  if (!fs.existsSync(publicKeyPath) || !fs.existsSync(privateKeyPath)) {
    console.error('❌ Keys not found! Run "npm run generate:keys" first.');
    return;
  }

  // Load keys
  const publicKeyPem = fs.readFileSync(publicKeyPath);
  const privateKeyPem = fs.readFileSync(privateKeyPath);

  // Test data - example order
  const orderData = {
    orderId: 'ORDER_12345',
    userId: 'user_67890',
    items: [
      { id: 'item1', quantity: 2, price: 25.99 },
      { id: 'item2', quantity: 1, price: 15.50 }
    ],
    total: 67.48,
    timestamp: new Date().toISOString()
  };

  const originalData = JSON.stringify(orderData, null, 2);
  console.log('📦 Original Order Data:');
  console.log(originalData);

  try {
    // Encrypt with public key (what frontend does)
    const publicKey = createPublicKey(publicKeyPem);
    const encrypted = publicEncrypt(publicKey, Buffer.from(originalData, 'utf8'));
    const encryptedBase64 = encrypted.toString('base64');

    console.log('\n🔒 Encrypted Data (Base64):');
    console.log(encryptedBase64);

    // Decrypt with private key (what backend does)
    const privateKey = createPrivateKey(privateKeyPem);
    const decrypted = privateDecrypt(privateKey, Buffer.from(encryptedBase64, 'base64'));
    const decryptedData = decrypted.toString('utf8');

    console.log('\n🔓 Decrypted Data:');
    console.log(decryptedData);

    // Verify data integrity
    const isMatch = originalData === decryptedData;
    console.log('\n✅ Encryption/Decryption Test:', isMatch ? 'PASSED' : 'FAILED');

    if (isMatch) {
      console.log('🎉 Your RSA key pair is working correctly!');
      console.log('📤 Send the public key to your frontend for encryption');
      console.log('🔐 Keep the private key secure on your backend for decryption');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test if script is executed directly
if (require.main === module) {
  testEncryptDecrypt();
}

module.exports = { testEncryptDecrypt };