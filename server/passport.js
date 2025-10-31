import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as InstagramStrategy } from 'passport-instagram';
import { Strategy as TikTokStrategy } from 'passport-tiktok';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  OAUTH_CALLBACK_BASE
} = process.env;

passport.serializeUser((user, done) => {
  done(null, user); // demo: sérialise tout l'objet user (en prod, stocke id seulement)
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${OAUTH_CALLBACK_BASE}/auth/google/callback`
  },
  (accessToken, refreshToken, profile, done) => {
    console.log('Google auth callback:', { 
      id: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName
    });
    const user = {
      provider: 'google',
      id: profile.id,
      displayName: profile.displayName,
      name: profile.name?.givenName || '',
      familyName: profile.name?.familyName || '',
      email: profile.emails && profile.emails[0]?.value,
      photo: profile.photos && profile.photos[0]?.value,
      followers: 0,
      likes: 0,
      raw: profile
    };
    // TODO: findOrCreate user in DB (server/database.js) and return DB user instead.
    return done(null, user);
  }));
}

// Instagram Strategy
if (process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET) {
  passport.use(new InstagramStrategy({
    clientID: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    callbackURL: `${process.env.OAUTH_CALLBACK_BASE}/auth/instagram/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = {
        provider: 'instagram',
        id: profile.id,
        displayName: profile.displayName,
        username: profile.username,
        photo: profile._json.data.profile_picture,
        followers: profile._json.data.counts?.followed_by || 0,
        likes: 0
      };
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

// TikTok Strategy
if (process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET) {
  passport.use(new TikTokStrategy({
    clientID: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    callbackURL: `${process.env.OAUTH_CALLBACK_BASE}/auth/tiktok/callback`,
    scope: ['user.info.basic']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = {
        provider: 'tiktok',
        id: profile.id,
        displayName: profile.displayName,
        username: profile.username,
        photo: profile.avatarUrl,
        followers: profile.followerCount || 0,
        likes: profile.likeCount || 0
      };
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

// Export passport instance
export default passport;