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
  tokenType: 'USD' | 'USDC' | 'LQD' | 'TSLA' | 'AAPL' | 'GOLD';
  recipient: string;
  amount: number;
}

export interface BurnOperation {
  tokenType: 'USD' | 'USDC' | 'LQD' | 'TSLA' | 'AAPL' | 'GOLD';
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
  private readonly MODULE_NAME = 'SpoutToken';
  
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
   * Mint tokens to a recipient
   */
  async mintTokens(operation: TokenOperation): Promise<TransactionResult> {
    try {
      this.logger.log(`Minting ${operation.amount} ${operation.tokenType} tokens to ${operation.recipient}`);

      const payload: InputEntryFunctionData = {
        function: `${this.CONTRACT_ADDRESS}::${this.MODULE_NAME}::mint`,
        typeArguments: [`${this.CONTRACT_ADDRESS}::${this.MODULE_NAME}::${operation.tokenType}`],
        functionArguments: [operation.recipient, operation.amount]
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

      this.logger.log(`Mint transaction completed: ${committedTransaction.hash}`);

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
      this.logger.log(`Admin burning ${operation.amount} ${operation.tokenType} tokens from ${operation.user}`);

      const payload: InputEntryFunctionData = {
        function: `${this.CONTRACT_ADDRESS}::${this.MODULE_NAME}::admin_burn_from`,
        typeArguments: [`${this.CONTRACT_ADDRESS}::${this.MODULE_NAME}::${operation.tokenType}`],
        functionArguments: [operation.user, operation.amount]
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
