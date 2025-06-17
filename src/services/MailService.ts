import Mailer, { SendMailOptions } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

export default class MailService {
  private static instance: Mailer.Transporter;

  static init() {
    if (!MailService.instance) {
      const options: SMTPTransport.Options = {};
      if (process.env.MAIL_SERVICE === 'sendgrid') {
        options.service = process.env.MAIL_SERVICE;
      } else if (process.env.MAIL_SERVICE === 'smtp') {
        options.host = process.env.MAIL_HOST;
        options.port = parseInt(process.env.MAIL_PORT ?? '587', 10);
        options.secure = process.env.MAIL_SECURE === 'true';
      } else {
        return console.error(
          'Mail service is not configured properly. Please set MAIL_SERVICE to either "sendgrid" or "smtp".',
        );
      }

      const transporter = Mailer.createTransport({
        ...options,
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
