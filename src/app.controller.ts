import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { Web3Service } from './web3/web3.service';
import { MintburnService } from './web3/mintburn.service';
import { SetKycVerificationDto, KycStatusResponseDto, KycVerificationResponseDto } from './dto/kyc.dto';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly web3Service: Web3Service,
    private readonly mintburnService: MintburnService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    const isConnected = await this.web3Service.isConnected();
    return {
      status: 'ok',
      aptos_connected: isConnected,
      network: this.web3Service.getNetworkConfig(),
    };
  }

  @Get('kyc/status/:userAddress')
  async getKycStatus(@Param('userAddress') userAddress: string): Promise<KycStatusResponseDto> {
    try {
      const isVerified = await this.mintburnService.isUserVerified(userAddress);
      return {
        success: true,
        userAddress,
        isVerified,
      };
    } catch (error) {
      this.logger.error(`Error checking KYC status for ${userAddress}:`, error);
      return {
        success: false,
        userAddress,
        isVerified: false,
        error: error.message,
      };
    }
  }

  @Post('kyc/verify')
  async verifyKyc(@Body() body: SetKycVerificationDto): Promise<KycVerificationResponseDto> {
    try {
      const { userAddress } = body;
      
      if (!userAddress) {
        return {
          success: false,
          userAddress: '',
          error: 'userAddress is required',
        };
      }

      // Always set verification to true when user calls this endpoint
      const isVerified = true;
      const result = await this.mintburnService.setUserVerification(userAddress, isVerified);
      
      return {
        success: result.success,
        transactionHash: result.hash,
        gasUsed: result.gasUsed,
        userAddress,
        ...(result.errorMessage && { error: result.errorMessage }),
      };
    } catch (error) {
      this.logger.error('Error setting KYC verification:', error);
      return {
        success: false,
        userAddress: body.userAddress || '',
        error: error.message,
      };
    }
  }
}
