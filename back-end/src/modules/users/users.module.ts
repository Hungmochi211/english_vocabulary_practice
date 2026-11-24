import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RefreshSession } from './entities/refresh-session.entity';
import { UsersService } from './users.service';
import { UsersController, AdminController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshSession])],
  controllers: [UsersController, AdminController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
