import { Injectable, Logger } from '@nestjs/common';
import { 
  Aptos, 
  AptosConfig, 
  Network, 
  Account, 
  Ed25519PrivateKey,
  InputEntryFunctionData,
} from '@aptos-labs/ts-sdk';

export interface TokenOperation {
  tokenType: 'LQD_NEW' | 'USDT_NEW' | 'USDC_NEW';
  recipient: string;
  amount: number;
}

export interface BurnOperation {
  tokenType: 'LQD_NEW' | 'USDT_NEW' | 'USDC_NEW';
  user: string;
  amount: number;
}

export interface TransactionResult {
  hash: string;
  success: boolean;
  gasUsed?: string;
  errorMessage?: string;
}

@Injectable()
export class MintburnService {
  private readonly logger = new Logger(MintburnService.name);
  private readonly aptos: Aptos;
  private readonly account: Account;

  // Contract configuration
  private readonly CONTRACT_ADDRESS = process.env.MODULE_PUBLISHER_ACCOUNT_ADDRESS || '';
  private readonly MODULE_NAME = 'SpoutTokenV2';
  private readonly KYC_MODULE_NAME = 'kyc_registry';
  
  // Module publisher account private key from environment variables
  private readonly ADMIN_PRIVATE_KEY = process.env.MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY || '';

  constructor() {
    // Validate environment variables
    if (!this.CONTRACT_ADDRESS) {
      throw new Error('MODULE_PUBLISHER_ACCOUNT_ADDRESS environment variable is required');
    }
    if (!this.ADMIN_PRIVATE_KEY) {
      throw new Error('MODULE_PUBLISHER_ACCOUNT_PRIVATE_KEY environment variable is required');
    }

    // Initialize Aptos client with testnet configuration
    const config = new AptosConfig({ network: Network.TESTNET });
    this.aptos = new Aptos(config);

    // Initialize admin account from private key loaded from environment variables
    try {
      const privateKey = new Ed25519PrivateKey(this.ADMIN_PRIVATE_KEY);
      this.account = Account.fromPrivateKey({ privateKey });
      this.logger.log(`Admin account initialized: ${this.account.accountAddress}`);
      this.logger.log(`Using contract address: ${this.CONTRACT_ADDRESS}`);
    } catch (error) {
      this.logger.error('Failed to initialize admin account:', error);
      throw error;
    }

    this.logger.log('MintBurn service initialized for testnet');
  }


  /**
   * Check if the service is connected and admin account is funded
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.aptos.getLedgerInfo();
      const balance = await this.aptos.getAccountAPTAmount({
        accountAddress: this.account.accountAddress
      });
      this.logger.log(`Admin account balance: ${balance} APT`);
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Aptos network or check balance:', error);
      return false;
    }
  }

  /**
   * Check if a user is KYC verified
   */
  async isUserVerified(userAddress: string): Promise<boolean> {
    try {
      const result = await this.aptos.view({
        payload: {
          function: `${this.CONTRACT_ADDRESS}::${this.KYC_MODULE_NAME}::is_verified`,
          typeArguments: [],
          functionArguments: [this.CONTRACT_ADDRESS, userAddress]
        }
      });

      const isVerified = result[0] as boolean;
      
      this.logger.log(`KYC verification status for ${userAddress}: ${isVerified}`);
      return isVerified;

    } catch (error) {
      this.logger.error(`Error checking KYC verification for user ${userAddress}:`, error);
      // Default to false if there's an error checking verification status
      return false;
    }
  }

  /**
   * Set KYC verification status for a user (Admin only)
   */
  async setUserVerification(userAddress: string, isVerified: boolean): Promise<TransactionResult> {
    this.logger.log(`Setting KYC verification for ${userAddress}`);
    try {

      const payload: InputEntryFunctionData = {
        function: `${this.CONTRACT_ADDRESS}::${this.KYC_MODULE_NAME}::set_verified`,
        typeArguments: [],
        functionArguments: [userAddress, isVerified]
      };

      const transaction = await this.aptos.transaction.build.simple({
        sender: this.account.accountAddress,
        data: payload
      });

      const committedTransaction = await this.aptos.signAndSubmitTransaction({
        signer: this.account,
        transaction
      });

      const executedTransaction = await this.aptos.waitForTransaction({
        transactionHash: committedTransaction.hash
      });

      return {
        hash: committedTransaction.hash,
        success: executedTransaction.success,
        gasUsed: executedTransaction.gas_used
      };

    } catch (error) {
      this.logger.error(`Error setting KYC verification for user ${userAddress}:`, error);
      return {
        hash: '',
        success: false,
        errorMessage: error.message
      };
    }
  }



  /**
   * Mint tokens to a recipient
   */
  async mintTokens(operation: TokenOperation): Promise<TransactionResult> {
    try {
      // Check if user is KYC verified before minting
      const isVerified = await this.isUserVerified(operation.recipient);
      if (!isVerified) {        
        // Auto-verify the user
        const verificationResult = await this.setUserVerification(operation.recipient, true);
        if (!verificationResult.success) {
          this.logger.error(`Failed to auto-verify user ${operation.recipient}. Cannot mint tokens.`);
          return {
            hash: '',
            success: false,
            errorMessage: `Failed to auto-verify user ${operation.recipient}. Minting operation rejected: ${verificationResult.errorMessage}`
          };
        }
        
        this.logger.log(`Successfully auto-verified user ${operation.recipient}. TX: ${verificationResult.hash}`);
      }

      this.logger.log(`User ${operation.recipient} is KYC verified. Minting ${operation.amount} ${operation.tokenType} tokens`);

      
      const payload: InputEntryFunctionData = {
        function: `${this.CONTRACT_ADDRESS}::${this.MODULE_NAME}::mint`,
        typeArguments: [`${this.CONTRACT_ADDRESS}::${this.MODULE_NAME}::${operation.tokenType}`],
        functionArguments: [operation.recipient, operation.amount]
      };

      this.logger.log(`Mint payload: ${JSON.stringify(payload, null, 2)}`);

      const transaction = await this.aptos.transaction.build.simple({
        sender: this.account.accountAddress,
        data: payload
      });

      const committedTransaction = await this.aptos.signAndSubmitTransaction({
        signer: this.account,
        transaction
      });

      const executedTransaction = await this.aptos.waitForTransaction({
        transactionHash: committedTransaction.hash
      });

      return {
        hash: committedTransaction.hash,
        success: executedTransaction.success,
        gasUsed: executedTransaction.gas_used
      };

    } catch (error) {
      this.logger.error('Error minting tokens:', error);
      return {
        hash: '',
        success: false,
        errorMessage: error.message
      };
    }
  }

  /**
   * Admin burn tokens from a user's account
   */
  async adminBurnTokens(operation: BurnOperation): Promise<TransactionResult> {
    try {
      // Check if user is KYC verified before burning
      const isVerified = await this.isUserVerified(operation.user);
      if (!isVerified) {
        
        // Auto-verify the user
        const verificationResult = await this.setUserVerification(operation.user, true);
        if (!verificationResult.success) {
          this.logger.error(`Failed to auto-verify user ${operation.user}. Cannot burn tokens.`);
          return {
            hash: '',
            success: false,
            errorMessage: `Failed to auto-verify user ${operation.user}. Burning operation rejected: ${verificationResult.errorMessage}`
          };
        }
        
        this.logger.log(`Successfully auto-verified user ${operation.user}. TX: ${verificationResult.hash}`);
      }

      this.logger.log(`User ${operation.user} is KYC verified. Admin burning ${operation.amount} ${operation.tokenType} tokens`);

      const payload: InputEntryFunctionData = {
        function: `${this.CONTRACT_ADDRESS}::${this.MODULE_NAME}::admin_burn_from`,
        typeArguments: [`${this.CONTRACT_ADDRESS}::${this.MODULE_NAME}::${operation.tokenType}`],
        functionArguments: [operation.user, operation.amount]
      };

      this.logger.log(`Burn payload: ${JSON.stringify(payload, null, 2)}`);

      const transaction = await this.aptos.transaction.build.simple({
        sender: this.account.accountAddress,
        data: payload
      });

      const committedTransaction = await this.aptos.signAndSubmitTransaction({
        signer: this.account,
        transaction
      });

      const executedTransaction = await this.aptos.waitForTransaction({
        transactionHash: committedTransaction.hash
      });

      this.logger.log(`Admin burn transaction completed: ${committedTransaction.hash}`);

      return {
        hash: committedTransaction.hash,
        success: executedTransaction.success,
        gasUsed: executedTransaction.gas_used
      };

    } catch (error) {
      this.logger.error('Error burning tokens:', error);
      return {
        hash: '',
        success: false,
        errorMessage: error.message
      };
    }
  }
}
