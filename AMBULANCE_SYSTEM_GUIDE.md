# Ambulance Emergency Alert System - User Guide

## How the System Works

This is a **Rapido-style ambulance dispatch system** with separate logins for **Patients (Customers)** and **Ambulance Drivers**.

---

## For Ambulance Drivers

### Step 1: Sign Up as Driver
1. Go to the sign-up page
2. Select **"Ambulance Driver"** from the role dropdown
3. Fill in:
   - First Name & Last Name
   - **Ambulance Number** (e.g., AMB-001)
   - **Vehicle Details** (model, equipment, capacity)
   - **Service Area** (e.g., Downtown, North District)
   - Email & Password
4. Click **"Create Account"**

### Step 2: Go Online to Receive Alerts
**IMPORTANT:** You MUST be online to receive emergency alerts!

1. After logging in, you'll see your **Driver Dashboard**
2. At the top right, there's an **Online/Offline toggle switch**
3. Click the switch to go **ONLINE** (it will turn green)
4. When prompted, **allow location access** in your browser
5. You will now see: "You are ONLINE and will receive emergency alerts from nearby patients"

### Step 3: Receiving Emergency Alerts
When a patient sends an emergency alert:

**In-App Notifications:**
- You'll receive a real-time notification on your dashboard
- Navigate to the **"Notifications" tab** to see all alerts
- Each alert shows:
  - Emergency type
  - Distance from you
  - Pickup address
  - Google Maps link

**SMS Alerts:**
- You'll also receive an SMS on your registered phone number
- The SMS contains:
  - Emergency type
  - Google Maps link to patient location
  - Pickup address (if provided)

### Step 4: Accepting Requests
1. Go to the **"Requests" tab**
2. Review the emergency details
3. Click **"Accept Request"** to take the job
4. Use the Google Maps link to navigate to the patient

---

## For Patients (Customers)

### Step 1: Sign Up as Customer
1. Go to the sign-up page
2. Select **"Customer"** from the role dropdown
3. Fill in your details and create account

### Step 2: Sending Emergency Alert

1. Go to the **"Emergency Ambulance"** section
2. Click **"Get My Location"** button
   - Allow location access when prompted
   - Your location will appear on the map

3. Fill in emergency details:
   - **Patient Name** (auto-filled from profile)
   - **Phone Number** (auto-filled from profile)
   - **Emergency Type** (select from dropdown)
   - **Pickup Address** (optional but recommended)
   - **Description** (optional)

4. **IMPORTANT:** Check the consent box:
   ☑ "I consent to sharing my contact information with nearby ambulance drivers"

5. Click **"Send Emergency Alert"**

### What Happens Next?
- The system finds all ambulance drivers who are:
  - Currently **ONLINE**
  - Within **50km** of your location
- Alerts are sent to up to **10 nearest drivers**
- You'll see a confirmation: "🚨 Emergency alert sent to X nearby ambulance drivers!"
- Both SMS and in-app notifications are sent to drivers

---

## Troubleshooting

### "0 drivers notified" - What's wrong?

**Common Reasons:**
1. **No drivers are online** - Drivers must toggle their status to "ONLINE" to receive alerts
2. **No drivers within 50km** - Try from a different location or call 108
3. **Drivers haven't set their location** - Drivers must allow location access
4. **Consent not given** - You must check the consent box

**For Drivers:**
- Make sure you're **ONLINE** (green badge at top)
- Check that **location permission** is granted
- Your location updates automatically when you toggle online

**For Patients:**
- Make sure you checked the **consent checkbox**
- Verify your **location was detected** (shows on map)
- Check that you filled in **all required fields**

### SMS Not Received?

**For Drivers:**
- Verify your **phone number** is correct in your profile
- Check your phone's **message inbox** (not spam)
- SMS delivery depends on the Fast2SMS API status

**Note:** Even if SMS fails, you'll still receive **in-app notifications** on your dashboard when online.

---

## Privacy & Security

### Data Sharing
- Patient information is only shared with drivers **after consent is given**
- SMS messages contain anonymized information
- Direct patient phone numbers are NOT shared in SMS
- Drivers must contact dispatch/app for full patient details

### Rate Limiting
- Patients can send maximum **3 emergency alerts per hour**
- This prevents system abuse
- If you hit the limit, wait for the cooldown period

---

## System Requirements

### For All Users:
- Modern web browser (Chrome, Firefox, Safari, Edge)
- **Location services enabled**
- Internet connection

### For Drivers:
- Valid phone number for SMS alerts
- Must be online to receive alerts
- Must allow location access

---

## Emergency Numbers
If the system doesn't find available drivers:
- **108** - National Ambulance Service (India)
- **102** - Medical Emergency (India)
- Call your local emergency services immediately

---

## Support
For technical issues or questions about the system, contact your system administrator.
