import { Module } from '@nestjs/common';
import { AuthFlowService } from './auth-flow.service';
import { IamController } from './iam.controller';
import { RecoveryController } from './recovery.controller';
import { SignInController } from './sign-in.controller';
import { SignOutController } from './sign-out.controller';
import { SignUpController } from './sign-up.controller';
import { StaffController } from './staff.controller';
import { TokenService } from './token.service';

@Module({
  controllers: [
    IamController,
    SignInController, SignOutController,
    SignUpController,
    RecoveryController,
    StaffController,
  ],
  providers: [TokenService, AuthFlowService],
})
export class IamModule {}
