import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: 'test/**/*.test.js',
  nodeResolve: true,
  browsers: [
    playwrightLauncher({
      product: 'chromium',
      launchOptions: {
        ...(process.env.CHROME_PATH
          ? { executablePath: process.env.CHROME_PATH }
          : {}),
        args: process.env.CI ? ['--no-sandbox'] : [],
      },
    }),
  ],
  coverageConfig: { include: ['src/**/*.js'] },
};
