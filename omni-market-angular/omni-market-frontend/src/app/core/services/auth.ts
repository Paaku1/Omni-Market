import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap, switchMap, from } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { UserCredentials } from '../../interfaces/user-credentials';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly API_URL = `${environment.gatewayUrl}/auth`;
  private userSubject = new BehaviorSubject<any>(null);
  public user$: Observable<any> = this.userSubject.asObservable();

  private currentRoleSubject = new BehaviorSubject<string>('bidder');
  public currentRole$: Observable<string> = this.currentRoleSubject.asObservable();

  supabase: SupabaseClient;

  // ── Core role extractor: tries EVERY known location role can live ──
  private extractRole(sources: any[]): string {
    for (const src of sources) {
      if (!src) continue;

      // Direct role string
      if (typeof src === 'string' && (src === 'seller' || src === 'bidder')) return src;

      // JWT token string → decode payload
      if (typeof src === 'string' && src.includes('.')) {
        try {
          const payload = JSON.parse(atob(src.split('.')[1]));
          const r = payload?.user_metadata?.role || payload?.app_metadata?.role;
          if (r === 'seller' || r === 'bidder') return r;
        } catch { /* not a JWT */ }
      }

      // Object → check all known metadata key spellings
      if (typeof src === 'object') {
        const candidates = [
          src?.user_metadata?.role,   // Supabase JS SDK style
          src?.userMetadata?.role,    // C# PascalCase serialized
          src?.UserMetadata?.role,    // C# PascalCase (capital U)
          src?.app_metadata?.role,
          src?.role,                  // flat role property
        ];
        for (const r of candidates) {
          if (r === 'seller' || r === 'bidder') return r;
        }
      }
    }
    return 'bidder'; // safe default
  }

  constructor(private http: HttpClient) {
    this.supabase = createClient(
      'https://jktxgbkbyvyqhkyvfdal.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdHhnYmtieXZ5cWhreXZmZGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Mzc0OTQsImV4cCI6MjA5MTIxMzQ5NH0.ItUx8dOH1UWPh-A2ZbynFJhp12Lu4XIwUB3XoI6GfTU',
    );

    // ── On startup: restore from localStorage token ──
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      try {
        const payload = JSON.parse(atob(savedToken.split('.')[1]));
        const user = {
          id: payload.sub,
          email: payload.email,
          user_metadata: payload.user_metadata || {},
          created_at: payload.created_at
        };
        this.userSubject.next(user);
        const role = this.extractRole([savedToken, user, payload]);
        this.setCurrentRole(role);
        console.log('[Auth] Restored from localStorage. Role:', role);
      } catch (e) {
        console.error('[Auth] Failed to parse saved token', e);
      }
    }

    // ── Supabase session on load (handles OAuth redirects & persisted sessions) ──
    this.supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        localStorage.setItem('token', session.access_token);
        this.userSubject.next(session.user);
        const role = this.extractRole([session.access_token, session.user]);
        this.setCurrentRole(role);
        console.log('[Auth] Supabase session found. Role:', role);
      }
    });

    // ── Auth state change listener (OAuth callback, token refresh, sign out) ──
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange:', event, session?.user?.email);

      if (session) {
        this.userSubject.next(session.user);
        localStorage.setItem('token', session.access_token);
        const role = this.extractRole([session.access_token, session.user]);
        this.setCurrentRole(role);
        console.log('[Auth] Auth state change. Role:', role);
      } else if (event === 'SIGNED_OUT') {
        this.userSubject.next(null);
        this.currentRoleSubject.next('bidder');
        localStorage.removeItem('token');
      }
    });
  }

  async loginWithGoogle(role: string = 'bidder') {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `http://localhost:4200/auth/callback?role=${role}`,
      },
    });
    if (error) console.error('OAuth Error:', error.message);
  }

  login(credentials: UserCredentials, requiredRole?: string) {
    return this.http.post(`${this.API_URL}/login`, credentials).pipe(
      switchMap((response: any) => {
        return from(this.handleLoginResponse(response, requiredRole));
      })
    );
  }

  private async handleLoginResponse(response: any, requiredRole?: string): Promise<any> {
    console.log('[Auth] Login response keys:', Object.keys(response));

    const token        = response.token        || response.Token;
    const refreshToken = response.refreshToken || response.RefreshToken || token;
    const userObj      = response.user         || response.User;

    if (!token) {
      throw new Error('No authentication token found in gateway response.');
    }

    // 1. Decode and extract role locally
    let role = this.extractRole([token, userObj]);
    console.log('[Auth] Initial extracted role:', role);
    
    // 2. Query Supabase directly for authoritative user role
    let freshUser: any = null;
    try {
      const { data: { user } } = await this.supabase.auth.getUser(token);
      if (user) {
        freshUser = user;
        role = this.extractRole([user]);
        console.log('[Auth] Supabase verified role:', role);
      }
    } catch (err) {
      console.warn('[Auth] getUser call failed (non-blocking):', err);
    }

    // 3. Strict Role Verification Check
    if (requiredRole && role !== requiredRole) {
      console.error(`[Auth] Role mismatch! User has role '${role}' but '${requiredRole}' is required.`);
      await this.logout();
      
      if (requiredRole === 'seller') {
        throw new Error('Access Denied: This account is registered as a Bidder. Please use the Bidder Portal.');
      } else {
        throw new Error('Access Denied: This account is registered as a Seller. Please use the Seller Portal.');
      }
    }

    // 4. Store token and set active session
    localStorage.setItem('token', token);
    this.setCurrentRole(role);
    this.userSubject.next(freshUser || this.normalizeUser(userObj, token));

    try {
      await this.supabase.auth.setSession({
        access_token: token,
        refresh_token: refreshToken
      });
    } catch (err) {
      console.warn('[Auth] setSession failed (non-blocking):', err);
    }

    return response;
  }

  // Normalize C# PascalCase user object to a consistent shape
  private normalizeUser(user: any, token?: string): any {
    if (!user) return null;

    // Try to build user_metadata from PascalCase fields
    const meta = user.user_metadata || user.userMetadata || user.UserMetadata || {};

    // Also decode from JWT if metadata is empty
    if ((!meta || Object.keys(meta).length === 0) && token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return {
          id: user.id || user.Id || payload.sub,
          email: user.email || user.Email || payload.email,
          user_metadata: payload.user_metadata || {},
          created_at: user.createdAt || user.created_at || payload.iat
        };
      } catch { /* ignore */ }
    }

    return {
      id: user.id || user.Id,
      email: user.email || user.Email,
      user_metadata: meta,
      created_at: user.createdAt || user.created_at
    };
  }

  register(user: any) {
    return this.http.post(`${this.API_URL}/signup`, user).pipe(
      catchError((error) => {
        if (error.status === 0) {
          return throwError(() => new Error('Cannot authenticate now, please try again later.'));
        }
        return throwError(() => error);
      }),
    );
  }

  getToken() {
    return localStorage.getItem('token');
  }

  getCurrentUserId(): string | null {
    const user = this.userSubject.value;
    return user ? (user.id || user.Id) : null;
  }

  getCurrentRole(): string {
    return this.currentRoleSubject.value;
  }

  setCurrentRole(role: string) {
    if (role !== 'seller' && role !== 'bidder') return; // guard
    this.currentRoleSubject.next(role);
  }

  toggleRole() {
    const nextRole = this.getCurrentRole() === 'bidder' ? 'seller' : 'bidder';
    this.setCurrentRole(nextRole);
  }

  async logout() {
    await this.supabase.auth.signOut();
    this.userSubject.next(null);
    this.currentRoleSubject.next('bidder');
    localStorage.removeItem('token');
  }

  async updateProfile(fullName: string, avatarUrl: string) {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('User must be logged in to update profile.');

    const { error: authError } = await this.supabase.auth.updateUser({
      data: { full_name: fullName, avatar_url: avatarUrl }
    });
    if (authError) throw authError;

    const { error: dbError } = await this.supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      });
    if (dbError) throw dbError;

    const currentUser = this.userSubject.value;
    if (currentUser) {
      this.userSubject.next({
        ...currentUser,
        user_metadata: {
          ...currentUser.user_metadata,
          full_name: fullName,
          avatar_url: avatarUrl
        }
      });
    }
  }
}
