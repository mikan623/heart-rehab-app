import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuthToken } from '@/lib/server-auth';
import MedicalClient from './MedicalClient';

export default async function MedicalPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/');

  const auth = verifyAuthToken(token);
  if (!auth) redirect('/');

  return <MedicalClient userId={auth.userId} />;
}
