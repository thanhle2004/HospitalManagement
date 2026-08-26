import { UserWithProfile } from './users.repository';
import { UserResponseDto } from './dto/user-response.dto';

export class UsersMapper {
  static toResponseDto(user: UserWithProfile): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      profile: user.profile
        ? {
            fullName: user.profile.fullName,
            phone: user.profile.phone,
            avatarUrl: user.profile.avatarUrl,
            gender: user.profile.gender,
            birthday: user.profile.birthday,
            address: user.profile.address,
            description: user.profile.description,
          }
        : null,
      // password Hash bị loại bỏ có chủ đích — không copy(...user)
    };
  }

  static toResponseDtoList(users: UserWithProfile[]): UserResponseDto[] {
    return users.map((u) => this.toResponseDto(u));
  }
}
