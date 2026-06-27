#!/usr/bin/env node

import BullMQService from '@services/BullMQService';

async function replayJob() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error('Usage: npm run replay-job <jobLogId>');
    process.exit(1);
  }

  const jobLogId = parseInt(args[0], 10);

  if (Number.isNaN(jobLogId)) {
    console.error('Invalid job log ID. Please provide a valid number.');
    process.exit(1);
  }

  console.log(`Replaying job with log ID: ${jobLogId}`);

  try {
    const newJobId = await BullMQService.replayJobById(jobLogId);

    if (newJobId) {
      console.log(`Job replayed successfully. New job ID: ${newJobId}`);
    } else {
      console.error('Failed to replay job');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error replaying job:', error);
    process.exit(1);
  }

  process.exit(0);
}

replayJob().catch(console.error);
