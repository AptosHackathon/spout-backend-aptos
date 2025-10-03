import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Web3Module } from './web3/web3.module';
import { PollingModule } from './polling/polling.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes the config available globally
      envFilePath: process.env.NODE_ENV === 'production' ? undefined : '.env', // Use .env only in local
      ignoreEnvFile: process.env.NODE_ENV === 'production', // Ignore .env file in production
    }),
    ScheduleModule.forRoot(),
    Web3Module,
    PollingModule,
    SupabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
