import { Request, Response } from 'express';
import { AuthManager } from '@fromcode/auth';
import { PluginManager } from '@fromcode/core';
import { users, systemSessions, systemRoles, eq, count, and, gt, sql } from '@fromcode/database';

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

      // Initialize default system roles
      await this.db.insert(systemRoles).values([
        { 
          slug: 'admin', 
          name: 'Administrator', 
          description: 'Complete unrestricted access to all system modules and settings.', 
          type: 'system',
          permissions: JSON.stringify(['*'])
        },
        { 
          slug: 'editor', 
          name: 'Content Editor', 
          description: 'Can create, edit and delete collections but cannot modify system settings.', 
          type: 'custom',
          permissions: JSON.stringify(['content:read', 'content:write'])
        },
        { 
          slug: 'user', 
          name: 'Standard User', 
          description: 'Regular account with access to assigned frontend capabilities only.', 
          type: 'custom',
          permissions: JSON.stringify([])
        }
      ]).onConflictDoNothing();
      
    } catch (e) {
      console.error('[AuthController] Setup initialization failed:', e);
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const hashedPassword = await this.auth.hashPassword(password);
    
    const [newUser]: any = await this.db.insert(users)
      .values({
        email,
        password: hashedPassword,
        roles: ['admin']
      })
      .returning();

    const jti = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const userResponse = { id: String(newUser.id), email: newUser.email, roles: ['admin'], jti };
    const token = await this.auth.generateToken(userResponse);
    
    // Store session in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.db.insert(systemSessions).values({
      userId: newUser.id,
      tokenId: jti,
      expiresAt: expiresAt,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    const cookieOptions = this.getCookieOptions(req);
    res.cookie('fc_token', token, cookieOptions);

    // Log Setup Activity
    try {
      await this.manager.writeLog(
        'INFO', 
        `System initialized. Admin account created: ${email}`, 
        'System', 
        { userId: newUser.id, email, ip: req.ip }
      );
    } catch (e) {}

    res.json({ 
      token,
      user: userResponse 
    });
  }

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    console.debug(`[AuthController] Login attempt for email: ${email}`);
    
    try {
      if (!email || !password) {
        console.warn(`[AuthController] Login failed: Missing email or password`);
        return res.status(400).json({ error: 'Email and password required' });
      }

      const results = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = results[0];
      
      if (user) {
        const isMatch = await this.auth.comparePassword(password, user.password || '');
        
        if (isMatch) {
          console.debug(`[AuthController] Password match for user: ${user.email}`);
          const roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : (user.roles || []);
          const jti = Math.random().toString(36).substring(2) + Date.now().toString(36);
          const userResponse = { id: user.id.toString(), email: user.email, roles, jti };
          const token = await this.auth.generateToken(userResponse);
          
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
          
          console.debug(`[AuthController] Generating token for JTI: ${jti}`);

          try {
            await this.db.insert(systemSessions).values({
              userId: user.id,
              tokenId: jti,
              expiresAt: expiresAt,
              userAgent: req.headers['user-agent'],
              ipAddress: req.ip
            });
            console.debug(`[AuthController] Session stored successfully for JTI: ${jti}`);
          } catch (sessionErr) {
            console.error(`[AuthController] Failed to store session:`, sessionErr);
            throw sessionErr;
          }

          const cookieOptions = this.getCookieOptions(req);
          res.cookie('fc_token', token, cookieOptions);

          // Log Login Activity
          try {
            await this.manager.writeLog(
              'INFO', 
              `Successful login for ${user.email}`, 
              'System', 
              { 
                userId: user.id, 
                email: user.email, 
                ip: req.ip, 
                userAgent: req.headers['user-agent'],
                jti
              }
            );
          } catch (logErr) {
            console.error('[AuthController] Failed to write login log:', logErr);
          }

          return res.json({ 
            token,
            user: userResponse 
          });
        } else {
          console.warn(`[AuthController] Password mismatch for user: ${email}`);
          // Log Failed Login Attempt
          try {
            await this.manager.writeLog(
              'WARN', 
              `Failed login attempt for ${email} (Invalid Password)`, 
              'System', 
              { email, ip: req.ip }
            );
          } catch (logErr) {}
          console.debug(`[AuthController] Hash in DB starts with: ${user.password?.substring(0, 10)}...`);
        }
      } else {
        console.warn(`[AuthController] User NOT FOUND in database: ${email}`);
        // Log Non-existent User attempt
        try {
          await this.manager.writeLog(
            'WARN', 
            `Failed login attempt for non-existent user: ${email}`, 
            'System', 
            { email, ip: req.ip }
          );
        } catch (logErr) {}
      }
    } catch (err: any) {
      console.error(`[AuthController] Login exception for ${email}:`, err);
      return res.status(500).json({ error: 'Internal server error during login' });
    }

    res.status(401).json({ error: 'Invalid email or password' });
  }

  async logout(req: any, res: Response) {
    if (req.user && req.user.jti) {
      try {
        await this.db.update(systemSessions)
          .set({ isRevoked: true, updatedAt: new Date() })
          .where(eq(systemSessions.tokenId, req.user.jti));
        
        // Log Logout Activity
        await this.manager.writeLog(
          'INFO', 
          `User logged out: ${req.user.email}`, 
          'System', 
          { userId: req.user.id, email: req.user.email, jti: req.user.jti }
        );
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
