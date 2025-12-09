/**
 * Setup Test User Script
 *
 * Creates a test user in your Convex/Better Auth database for E2E testing.
 * Run this once after setting up your Convex project.
 *
 * Usage: pnpm run setup:test-user
 */

import { config } from 'dotenv';

// Load .env.test file
config({ path: '.env.test' });

const SITE_URL = process.env.SITE_URL || 'http://localhost:5173';

async function setupTestUser() {
	const email = process.env.TEST_USER_EMAIL;
	const password = process.env.TEST_USER_PASSWORD;
	const name = process.env.TEST_USER_NAME || 'Test User';

	if (!email || !password) {
		console.error('❌ Error: TEST_USER_EMAIL and TEST_USER_PASSWORD must be set.');
		console.error('');
		console.error('1. Copy .env.test.example to .env.test');
		console.error('2. Update the values as needed');
		console.error('3. Run this script again');
		process.exit(1);
	}

	console.log('🔧 Setting up test user...');
	console.log(`   Email: ${email}`);
	console.log(`   Name: ${name}`);
	console.log(`   Site URL: ${SITE_URL}`);
	console.log('');

	// Try to sign up the user
	try {
		const signUpResponse = await fetch(`${SITE_URL}/api/auth/sign-up/email`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				email,
				password,
				name
			})
		});

		if (signUpResponse.ok) {
			console.log('✅ Test user created successfully!');
			return;
		}

		const errorData = await signUpResponse.json().catch(() => ({}));

		// Check if user already exists
		if (
			signUpResponse.status === 400 ||
			errorData.message?.includes('already exists') ||
			errorData.code === 'USER_ALREADY_EXISTS'
		) {
			console.log('ℹ️  Test user already exists. Verifying credentials...');

			// Try to sign in to verify credentials work
			const signInResponse = await fetch(`${SITE_URL}/api/auth/sign-in/email`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					email,
					password
				})
			});

			if (signInResponse.ok) {
				console.log('✅ Test user credentials verified!');
				return;
			} else {
				console.error('❌ Error: Test user exists but credentials are incorrect.');
				console.error('   Please update .env.test with the correct password,');
				console.error('   or delete the user from your database and run this script again.');
				process.exit(1);
			}
		}

		console.error('❌ Error creating test user:', errorData);
		process.exit(1);
	} catch (error) {
		if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
			console.error('❌ Error: Could not connect to the server.');
			console.error('   Make sure your dev server is running: pnpm run dev');
			process.exit(1);
		}
		throw error;
	}
}

setupTestUser().catch((error) => {
	console.error('❌ Unexpected error:', error);
	process.exit(1);
});
