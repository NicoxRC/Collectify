export interface AppConfig {
  nodeEnv: string;
  port: number;
  clientUrl: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  name: string;
}

export interface JwtConfig {
  secret: string;
  accessExpiration: string;
  refreshExpiration: string;
}

export interface WhatsappConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
}

export interface CronConfig {
  overdueReminderExpression: string;
  upcomingDueReminderExpression: string;
  upcomingDueReminderDays: number[];
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  whatsapp: WhatsappConfig;
  cron: CronConfig;
}

export default (): Configuration => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  },
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    name: process.env.DATABASE_NAME ?? 'collectify',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
  },
  whatsapp: {
    phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN ?? '',
    businessAccountId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID ?? '',
  },
  cron: {
    overdueReminderExpression: process.env.OVERDUE_REMINDER_CRON ?? '0 9 * * 1',
    upcomingDueReminderExpression:
      process.env.UPCOMING_DUE_REMINDER_CRON ?? '0 8 * * *',
    upcomingDueReminderDays: (process.env.UPCOMING_DUE_REMINDER_DAYS ?? '5,3,1')
      .split(',')
      .map((value) => parseInt(value.trim(), 10)),
  },
});
