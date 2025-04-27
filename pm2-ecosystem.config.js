module.exports = {
  apps: [
    {
      name: 'spex-bot',
      script: 'npm',
      args: 'run start',
      watch: true,
      ignore_watch: ['node_modules', 'spex-bot-log.txt'],
      log_file: 'spex-bot-log.txt',
      time: true,
      cron_restart: '0 0 1 */4 *', // At 00:00 on day-of-month 1 in every 4th month (https://crontab.guru/#0_0_1_*/4_*)
      restart_delay: '3000',
    },
  ],
};
