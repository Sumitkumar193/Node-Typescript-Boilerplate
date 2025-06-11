import Mailer, { SendMailOptions } from 'nodemailer';

export default class MailService {
  private static instance: Mailer.Transporter;

  static init() {
    if (!MailService.instance) {
      if (!process.env.MAIL_HOST) {
        return console.log('Mail service not configured');
      }

      const transporter = Mailer.createTransport({
        host: process.env.MAIL_HOST,
        port: parseInt(process.env.MAIL_PORT ?? '587', 10),
        secure: process.env.MAIL_SECURE === 'true',
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      transporter.verify((error) => {
        if (error) {
          console.log(error);
        } else {
          console.log('Mail Server is ready to take our messages');
        }
      });

      MailService.instance = transporter;
    }

    return MailService.instance;
  }

  static async send(data: SendMailOptions): Promise<void> {
    if (!MailService.instance) {
      MailService.init();
    }

    const mailOptions = {
      ...data,
      from: process.env.MAIL_FROM,
    };

    return new Promise((resolve, reject) => {
      MailService.instance.sendMail(mailOptions, (error, info) => {
        if (error) {
          reject(error);
        } else {
          resolve(info);
        }
      });
    });
  }
}
