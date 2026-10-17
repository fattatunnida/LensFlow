import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
export default function Index() {
  const { state } = useAuth();
  return <Redirect href={state.status === 'authenticated' ? '/home' : '/login'} />;
}
