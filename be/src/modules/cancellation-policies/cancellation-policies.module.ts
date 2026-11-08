import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CancellationPoliciesController } from './controllers/cancellation-policies.controller';
import { CancellationPolicyEntity } from './entities/cancellation-policy.entity';
import { CANCELLATION_POLICY_REPOSITORY } from './interfaces/cancellation-policy.repository.interface';
import { TypeOrmCancellationPolicyRepository } from './repositories/typeorm-cancellation-policy.repository';
import { CancellationPoliciesService } from './services/cancellation-policies.service';

@Module({
  imports: [TypeOrmModule.forFeature([CancellationPolicyEntity])],
  controllers: [CancellationPoliciesController],
  providers: [
    CancellationPoliciesService,
    {
      provide: CANCELLATION_POLICY_REPOSITORY,
      useClass: TypeOrmCancellationPolicyRepository,
    },
  ],
  exports: [CancellationPoliciesService],
})
export class CancellationPoliciesModule {}
