import { Request, Response } from 'express';
import { AuthManager } from '@fromcode/auth';
import { PluginManager } from '@fromcode/core';
import { users, systemSessions, eq, count, and, gt, sql } from '@fromcode/database';

export class AuthController {
  private db: any;

  constructor(private manager: PluginManager, private auth: AuthManager) {
    this.db = (manager as any).db.drizzle;
  }

  async getStatus(req: Request, res: Response) {
    try {
      const result = await this.db
        .select({ total: count() })
        .from(users);
      
      const initialized = Number(result[0].total) > 0;
      
      // If system not initialized, clear any stale session cookies
      if (!initialized) {
        const cookieOptions = this.getCookieOptions(req, true);
        res.clearCookie('fc_token', cookieOptions);
      }
      
      res.json({ initialized });
    } catch (e) {
      res.json({ initialized: false });
    }
  }

  async setup(req: Request, res: Response) {
    try {
      const check = await this.db.select({ total: count() }).from(users);
      if (Number(check[0].total) > 0) {
        return res.status(400).json({ error: 'System already initialized' });
      }
    } catch (e) {}

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const hashedPassword = await this.auth.hashPassword(password);
    
    const [newUser]: any = await this.db.insert(users)
      .values({
        email,
        password: hashedPassword,
        roles: JSON.stringify(['admin'])
      })
      .returning();

    const jti = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const userResponse = { id: newUser.id, email: newUser.email, roles: ['admin'], jti };
    const token = await this.auth.generateToken(userResponse);
    
    // Store session in DB
    await this.db.insert(systemSessions).values({
      userId: newUser.id,
      tokenId: jti,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    const cookieOptions = this.getCookieOptions(req);
    res.cookie('fc_token', token, cookieOptions);
    res.json({ user: userResponse });
  }

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    
    try {
      const [user]: any = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
      
      if (user && await this.auth.comparePassword(password, user.password || '')) {
        const roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : (user.roles || []);
        const jti = Math.random().toString(36).substring(2) + Date.now().toString(36);
        const userResponse = { id: user.id.toString(), email: user.email, roles, jti };
        const token = await this.auth.generateToken(userResponse);
        
        await this.db.insert(systemSessions).values({
          userId: user.id,
          tokenId: jti,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip
        });

        const cookieOptions = this.getCookieOptions(req);
        res.cookie('fc_token', token, cookieOptions);
        return res.json({ user: userResponse });
      }
    } catch (err) {}

    res.status(401).json({ error: 'Invalid email or password' });
  }

  async logout(req: any, res: Response) {
    if (req.user && req.user.jti) {
      try {
        await this.db.update(systemSessions)
          .set({ isRevoked: true, updatedAt: new Date() })
          .where(eq(systemSessions.tokenId, req.user.jti));
      } catch (e) {}
    }

    const cookieOptions = this.getCookieOptions(req, true);
    res.clearCookie('fc_token', cookieOptions);
    res.json({ success: true });
  }

  async getSessions(req: Request, res: Response) {
    try {
      const result = await this.db.select({
        id: systemSessions.id,
        userId: systemSessions.userId,
        tokenId: systemSessions.tokenId,
        userAgent: systemSessions.userAgent,
        ipAddress: systemSessions.ipAddress,
        isRevoked: systemSessions.isRevoked,
        expiresAt: systemSessions.expiresAt,
        createdAt: systemSessions.createdAt,
        updatedAt: systemSessions.updatedAt,
        email: users.email
      })
      .from(systemSessions)
      .innerJoin(users, eq(systemSessions.userId, users.id))
      .where(and(
        eq(systemSessions.isRevoked, false),
        gt(systemSessions.expiresAt, new Date())
      ))
      .orderBy(sql`${systemSessions.createdAt} DESC`);

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  }

  async killSession(req: Request, res: Response) {
    const { id } = req.params;
    try {
      await this.db.update(systemSessions)
        .set({ isRevoked: true, updatedAt: new Date() })
        .where(eq(systemSessions.id, id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to kill session' });
    }
  }

  private getCookieOptions(req: Request, isLogout = false) {
    const options: any = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && (req.protocol === 'https' || req.get('x-forwarded-proto') === 'https'),
      sameSite: 'lax',
      path: '/',
    };

    if (!isLogout) {
      options.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    if (req.hostname.includes('.') && !req.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) && req.hostname !== 'localhost') {
      const parts = req.hostname.split('.');
      if (parts.length >= 2) {
        options.domain = '.' + parts.slice(-2).join('.');
      }
    }

    return options;
  }
}
