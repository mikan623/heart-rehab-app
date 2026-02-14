// 型定義を直接記述（Prisma Client生成を待たない）
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: string;
  userId: string;
  displayName?: string;
  age?: number;
  gender?: string;
  height?: number;
  targetWeight?: number;
  diseases: string[];
  medications?: string;
  physicalFunction?: string;
  emergencyContact?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthRecord {
  id: string;
  userId: string;
  date: Date;
  time: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  pulse?: number;
  weight?: number;
  exercise?: unknown;
  meal?: unknown;
  dailyLife?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  lineUserId?: string;
  isRegistered: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// カスタム型定義
export interface HealthRecordWithUser extends HealthRecord {
  user: User;
}

export interface ProfileWithUser extends Profile {
  user: User;
}

export interface FamilyMemberWithUser extends FamilyMember {
  user: User;
}