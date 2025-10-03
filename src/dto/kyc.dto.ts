export class SetKycVerificationDto {
  userAddress: string;
}

export class KycStatusResponseDto {
  success: boolean;
  userAddress: string;
  isVerified: boolean;
  error?: string;
}

export class KycVerificationResponseDto {
  success: boolean;
  transactionHash?: string;
  gasUsed?: string;
  userAddress: string;
  error?: string;
}