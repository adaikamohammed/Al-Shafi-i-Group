import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Get OAuth2 access token using the Service Account JSON
async function getAccessToken(serviceAccount: any): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud: 'https://oauth2.googleapis.com/token',
    exp: exp,
    iat: iat
  })).toString('base64url');
  
  const tokenInput = `${header}.${payload}`;
  
  const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(tokenInput), privateKey).toString('base64url');
  
  const jwt = `${tokenInput}.${signature}`;
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to get access token: ${errText}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

export async function POST(request: Request) {
  try {
    const { targetUid, title, body } = await request.json();

    if (!targetUid || !title || !body) {
      return NextResponse.json({ error: 'Missing required fields: targetUid, title, body' }, { status: 400 });
    }

    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountEnv) {
      console.warn('FIREBASE_SERVICE_ACCOUNT environment variable is not configured.');
      return NextResponse.json({ 
        success: false, 
        error: 'FIREBASE_SERVICE_ACCOUNT is not configured on the server. Push notification was bypassed.' 
      }, { status: 200 }); // Return 200 to not crash client flow, just bypass
    }

    const serviceAccount = JSON.parse(serviceAccountEnv);
    const projectId = serviceAccount.project_id || 'al-shafi-i-quran-school';
    
    // 1. Get OAuth2 Access Token
    const accessToken = await getAccessToken(serviceAccount);

    // 2. Fetch User's FCM Tokens from Firebase Realtime Database REST API
    const dbUrl = `https://${projectId}-default-rtdb.firebaseio.com/users/${targetUid}/profile/fcmTokens.json?access_token=${accessToken}`;
    const dbResponse = await fetch(dbUrl);
    
    if (!dbResponse.ok) {
      const dbErrText = await dbResponse.text();
      return NextResponse.json({ error: `Failed to fetch FCM tokens: ${dbErrText}` }, { status: 500 });
    }

    const fcmTokens: string[] | null = await dbResponse.json();

    if (!fcmTokens || !Array.isArray(fcmTokens) || fcmTokens.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No FCM tokens found for the target user. Notification not sent.' 
      });
    }

    // 3. Send FCM Notification to each token
    const results = [];
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    for (const token of fcmTokens) {
      try {
        const fcmResponse = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: {
              token: token,
              notification: {
                title: title,
                body: body
              },
              webpush: {
                notification: {
                  icon: '/icon-192.png',
                  badge: '/icon-192.png'
                }
              }
            }
          })
        });

        const fcmData = await fcmResponse.json();
        results.push({
          token: token.substring(0, 10) + '...',
          success: fcmResponse.ok,
          response: fcmData
        });
      } catch (err: any) {
        results.push({
          token: token.substring(0, 10) + '...',
          success: false,
          error: err.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      sentCount: results.filter(r => r.success).length,
      totalCount: fcmTokens.length,
      results
    });

  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error during push notification' 
    }, { status: 500 });
  }
}
