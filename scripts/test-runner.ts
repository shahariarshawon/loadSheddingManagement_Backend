import { spawn } from 'child_process';

const testSuites = [
  { name: 'Phase 3: Auth, RBAC & Security', file: 'scripts/test-phase3.ts' },
  { name: 'Phase 4: Power Distribution Network & Outages', file: 'scripts/test-phase4.ts' },
  { name: 'Phase 5: Reports, Technicians & Restoration', file: 'scripts/test-phase5.ts' },
  { name: 'Phase 6: Stripe Payments & Premium Feature', file: 'scripts/test-phase6.ts' },
  { name: 'Phase 7: Validation, Concurrency & Admin Stats', file: 'scripts/test-phase7.ts' },
];

async function runSuite(suite: { name: string; file: string }): Promise<{ success: boolean; durationMs: number }> {
  console.log(`\n============================================================`);
  console.log(`🚀 RUNNING: ${suite.name} (${suite.file})`);
  console.log(`============================================================`);

  const startTime = Date.now();

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? 'bun.cmd' : 'bun';
    const child = spawn(cmd, ['run', suite.file], { stdio: 'inherit', shell: isWindows });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      resolve({ success: code === 0, durationMs });
    });

    child.on('error', (err) => {
      console.error(`Failed to launch ${suite.file}:`, err);
      resolve({ success: false, durationMs: Date.now() - startTime });
    });
  });
}

async function main() {
  console.log('🏁 GridWatch API — Complete End-to-End Regression Test Runner\n');

  let passedSuites = 0;
  let failedSuites = 0;

  for (const suite of testSuites) {
    const result = await runSuite(suite);
    if (result.success) {
      passedSuites++;
    } else {
      failedSuites++;
      console.error(`❌ Suite failed: ${suite.name}`);
    }
  }

  console.log('\n============================================================');
  console.log('📊 FINAL TEST RESULTS SUMMARY');
  console.log('============================================================');
  console.log(`  Suites Passed: ${passedSuites} / ${testSuites.length}`);
  console.log(`  Suites Failed: ${failedSuites} / ${testSuites.length}`);
  console.log('============================================================');

  if (failedSuites > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL TEST SUITES PASSED FLAWLESSLY WITH ZERO FAILURES!\n');
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
