const { generateKeyPairSync } = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Generate RSA key pair for order encryption/decryption
 * Public key will be sent to frontend for encryption
 * Private key will be kept on backend for decryption
 */
function generateRSAKeyPair() {
  console.log('🔑 Generating RSA key pair...');
  
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048, // Key size in bits
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  // Create keys directory if it doesn't exist
  const keysDir = path.join(__dirname, 'keys');
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir);
    console.log('📁 Created keys directory');
  }

  // Save keys to files
  const publicKeyPath = path.join(keysDir, 'public.pem');
  const privateKeyPath = path.join(keysDir, 'private.pem');

  fs.writeFileSync(publicKeyPath, publicKey);
  fs.writeFileSync(privateKeyPath, privateKey);

  console.log('✅ Keys generated successfully!');
  console.log(`📄 Public key saved to: ${publicKeyPath}`);
  console.log(`🔒 Private key saved to: ${privateKeyPath}`);
  
  console.log('\n📋 Public Key (send this to frontend):');
  console.log(publicKey);
  
  console.log('\n🔐 Private Key (keep this secure on backend):');
  console.log(privateKey);

  // Also save as JSON for easy import
  const keyPair = {
    publicKey,
    privateKey,
    generated: new Date().toISOString(),
    purpose: 'Order encryption/decryption for frontend-backend communication'
  };

  const jsonPath = path.join(keysDir, 'keypair.json');
  fs.writeFileSync(jsonPath, JSON.stringify(keyPair, null, 2));
  console.log(`\n💾 Key pair also saved as JSON to: ${jsonPath}`);

  return { publicKey, privateKey };
}

// Run the key generation
if (require.main === module) {
  try {
    generateRSAKeyPair();
  } catch (error) {
    console.error('❌ Error generating keys:', error.message);
    process.exit(1);
  }
}

module.exports = { generateRSAKeyPair };