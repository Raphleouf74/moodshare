import express from 'express';
const router = express.Router();
import passport from '../passport.js';  // Add .js extension

// Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/auth/failure', session: true }),
    (req, res) => {
        const user = req.user || {};
        const payload = JSON.stringify(user).replace(/</g, '\\u003c');
        res.send(`<!doctype html><html><body>
      <script>
        try {
          window.opener.postMessage({ type: 'oauth', user: ${payload} }, window.location.origin);
        } catch(e){}
        window.close();
      </script>
    </body></html>`);
    }
);

router.get('/failure', (req, res) => res.status(401).send('Authentication failed'));


export default router;  // Change to export default