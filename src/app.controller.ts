import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';
import { Web3Service } from './web3/web3.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly web3Service: Web3Service,
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
}
