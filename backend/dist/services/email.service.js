"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailProvider = exports.SmtpEmailProvider = exports.MockEmailProvider = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
class MockEmailProvider {
    async sendMail(to, subject, htmlContent) {
        console.warn('\n--------------------------------------------------');
        console.warn(`[MOCK EMAIL PROVIDER]`);
        console.warn(`TO: ${to}`);
        console.warn(`SUBJECT: ${subject}`);
        console.warn('HTML BODY:');
        console.warn(htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
        console.warn('--------------------------------------------------\n');
        return true;
    }
}
exports.MockEmailProvider = MockEmailProvider;
class SmtpEmailProvider {
    transporter;
    constructor() {
        const host = process.env.SMTP_HOST || '';
        const port = Number(process.env.SMTP_PORT) || 587;
        const user = process.env.SMTP_USER || '';
        const pass = process.env.SMTP_PASS || '';
        const secure = process.env.SMTP_SECURE === 'true';
        // Optimize setup specifically if host points to Gmail
        if (host.toLowerCase() === 'gmail' || host.toLowerCase().includes('gmail.com')) {
            this.transporter = nodemailer_1.default.createTransport({
                service: 'gmail',
                auth: {
                    user,
                    pass
                }
            });
        }
        else {
            this.transporter = nodemailer_1.default.createTransport({
                host,
                port,
                secure,
                auth: {
                    user,
                    pass
                }
            });
        }
    }
    async verifyConnection() {
        try {
            await this.transporter.verify();
            console.log('[Email Service] SMTP connection verified successfully.');
        }
        catch (err) {
            console.error('[Email Service] SMTP connection verification failed:');
            if (err.code === 'EAUTH') {
                console.error('  -> Authentication failed. Please verify SMTP_USER and SMTP_PASS (or App Password).');
            }
            else if (err.code === 'ESOCKET') {
                console.error('  -> Socket error. Please verify SMTP_HOST, SMTP_PORT, and SMTP_SECURE configuration.');
            }
            else {
                console.error(`  -> Details: ${err.message || err}`);
            }
            if (process.env.NODE_ENV === 'production') {
                console.error('FATAL CONFIGURATION ERROR: SMTP connection verification failed in production mode.');
                process.exit(1);
            }
        }
    }
    async sendMail(to, subject, htmlContent) {
        try {
            const from = process.env.SMTP_FROM || '"HighwayPool" <noreply@highwaypool.com>';
            await this.transporter.sendMail({
                from,
                to,
                subject,
                html: htmlContent
            });
            console.log(`[Email Service] SMTP Email sent successfully to ${to}`);
            return true;
        }
        catch (err) {
            console.error(`[Email Service] SMTP connection failed to send email to ${to}:`, err);
            return false;
        }
    }
}
exports.SmtpEmailProvider = SmtpEmailProvider;
// Validate SMTP environment variables
const missingVars = [];
if (!process.env.SMTP_HOST)
    missingVars.push('SMTP_HOST');
if (!process.env.SMTP_USER)
    missingVars.push('SMTP_USER');
if (!process.env.SMTP_PASS)
    missingVars.push('SMTP_PASS');
const hasSmtpConfig = missingVars.length === 0;
let activeProvider;
if (hasSmtpConfig) {
    console.log('SMTP Email Provider Enabled');
    activeProvider = new SmtpEmailProvider();
}
else {
    if (process.env.NODE_ENV === 'production') {
        console.error(`FATAL CONFIGURATION ERROR: Missing required SMTP configuration variables in production: ${missingVars.join(', ')}`);
        process.exit(1);
    }
    console.log('Mock Email Provider Enabled');
    activeProvider = new MockEmailProvider();
}
exports.emailProvider = activeProvider;
