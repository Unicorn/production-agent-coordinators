/**
 * Sign In Page
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { YStack, XStack, Text, Button, Input, H1, Card } from 'tamagui';
import { createClient } from '@/lib/supabase/client';

export default function SignInPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      backgroundColor="$gray2"
      padding="$4"
    >
      <Card width={400} maxWidth="100%" padding="$6" elevate>
        <form onSubmit={handleSignIn}>
          <YStack gap="$4">
            <YStack gap="$2" alignItems="center">
              <H1>Sign In</H1>
              <Text color="$gray11">Welcome back to Workflow Builder</Text>
            </YStack>

            {error && (
              <Card padding="$3" backgroundColor="$red3" borderColor="$red7" borderWidth={1}>
                <Text color="$red11" fontSize="$3">
                  {error}
                </Text>
              </Card>
            )}

            <YStack gap="$2">
              <Text fontSize="$3" fontWeight="600">
                Email
              </Text>
              <Input
                size="$4"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                disabled={loading}
              />
            </YStack>

            <YStack gap="$2">
              <Text fontSize="$3" fontWeight="600">
                Password
              </Text>
              <Input
                size="$4"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                disabled={loading}
              />
            </YStack>

            <Button
              size="$4"
              theme="blue"
              onPress={handleSignIn}
              disabled={loading || !email || !password}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <XStack gap="$2" justifyContent="center">
              <Text fontSize="$3" color="$gray11">
                Don't have an account?
              </Text>
              <Link href="/auth/signup">
                <Text fontSize="$3" color="$blue10" fontWeight="600">
                  Sign Up
                </Text>
              </Link>
            </XStack>
          </YStack>
        </form>
      </Card>
    </YStack>
  );
}

