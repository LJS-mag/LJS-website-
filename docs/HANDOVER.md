# Handover guide

Two parts: **A. one-time setup** (done together on a call) and **B. everyday use** (for the society).

---

## A. One-time setup (about 30 minutes, with the developer)

You need: the society's shared email address, and one person who will be the main owner. Add a second owner so access is never lost when someone leaves.

1. **Create a GitHub account** at github.com using the society email. (This is the only account the website needs.)
2. **Create the website repository.** New repository, name it for example `website`, set it to **Public** (needed for free hosting; it only holds what the public site already shows).
3. **Upload the website code** to that repository (the developer does this from the `ljs-site` folder).
4. **Turn on hosting:** repository Settings > Pages > Build and deployment > Source: **GitHub Actions**. After the first run finishes (Actions tab, about 2 minutes) the site is live at the address shown there.
5. **Form key:** go to web3forms.com, enter the society email, and copy the access key they send. (This is how applications and reviews reach the inbox.)
6. **Make the admin token** (this is the password the admin page uses to save changes):
   - GitHub > your profile picture > Settings > Developer settings > Personal access tokens > **Fine-grained tokens** > Generate new token.
   - Name: "Website admin". Expiration: 1 year.
   - Repository access: **Only select repositories** > choose the website repository.
   - Permissions: **Contents: Read and write**, **Actions: Read-only**.
   - Generate, and copy the token (it is shown once).
7. **Set up the admin on each device** (laptop and phone): open `your-site-address/admin/`, enter `account-name/website`, paste the token, choose a PIN of at least 6 digits. The token is stored on that device only, locked by the PIN.
8. In the admin: **Settings** > add the contact email and the form key > Save > **Publish**.
   - **Using the society's own Google Form for applications?** Also paste its link (from the Send button in Google Forms, starting with `https://forms.gle/` or `https://docs.google.com/forms/`) into **Application form link**. The Apply page then shows a button that opens that form, and answers stay in Google Forms/Sheets. The form key is still needed for **reviews**.
9. **Replace the sample content** (Dashboard shows exactly what is left): issues, journal posts and reviews marked "Sample".
10. Optional: **install the admin** on the phone (browser menu > "Add to Home screen") so it opens like an app.
11. Optional: **custom domain.** Buy a domain in the society's name, then Settings > Pages > Custom domain. Add repository variables `SITE_URL` (for example `https://ljs.org`) and `BASE_PATH` (`/`), then run the "Build and deploy" workflow again.

---

## B. Everyday use

Open `your-site-address/admin/` and enter your PIN. Make changes, then press **Publish** at the bottom. The website updates in about two minutes; a bar tells you when it is done.

Nothing is saved to the website until you press Publish. Your unpublished changes stay on your device if you close the page.

### Add an issue
Issues > Add an issue. Fill in the number, title, month and description, choose a cover colour, and choose the **PDF**. Wait for "Preparing page..." to finish (a laptop is faster than a phone, and a long PDF can take a minute), then Save and Publish. Each page becomes an image for the book reader.

### Write a journal post
Journal > Write a post. Add title, author, category, date and text (blank line between paragraphs; start a line with `>` for a pull quote). A cover photo is optional.

### Add or edit a team member
Team > Add a team member (or tap a name to edit). Photos are cropped to a portrait and shrunk automatically.

### Show Instagram posts on the home page
The home page has a "Latest on Instagram" grid. Instagram does not allow a free website to read its feed automatically, so you add each post yourself (it takes a minute): Instagram tab > Add a post. Open the post on Instagram, tap Share > Copy link, and paste it. Save the post's photo to your device (press and hold on a phone) and upload it. Choose the date, and how many photos the post has (this shows the "1/3" badge). Save and Publish. The grid shows the newest 8 posts, and each tile opens the real post.

#### Make the Instagram posts appear automatically (optional)
Instead of adding posts by hand, you can connect a free feed so the newest posts show up by themselves.
1. The Instagram account must be a **Business or Creator** account (free to switch: Instagram > Settings > Account type and tools > Switch to professional account).
2. Go to **behold.so**, sign up with the society email, and connect the Instagram account.
3. Create a feed, choose the **JSON** output (not a widget), and copy the feed link. It starts with `https://feeds.behold.so/`.
4. In the admin: **Settings** > "Automatic Instagram feed link" > paste it > Save > **Publish**.

Good to know: the free plan shows the **latest 6 posts**, refreshes about **once a day**, and allows about **1,200 views a month**. Visitors' devices remember the feed for 6 hours, so repeat visits do not count. If the limit is passed, Behold pauses the free feed until next month, and the website shows the posts you added by hand instead, so the section never goes blank. To stop using the feed, empty the field in Settings and Publish.

### Approve a review
When someone leaves a review, the society gets an email. Copy the block under "paste this into Admin > Reviews", open Reviews, paste it, press **Check it**, then **Approve and add**, then Publish. You can also Hide or Delete any review later. Stars and averages update when you publish.

### Applications
Applications arrive by email at the society inbox. To pause them, Settings > untick "Applications are open" > Save > Publish.

### Backup
Home > **Download a backup** gives you one file with all content (issues, journal, Instagram posts, team, reviews and settings). The website also keeps every earlier version automatically.

---

## If something goes wrong

| Problem | What to do |
|---|---|
| "The token was rejected" or the admin cannot save | The token expired (they last 1 year) or was removed. Make a new token (step 6), then on the login screen choose "Set this device up again". |
| "The website changed somewhere else" | Someone else published first. Close and reopen the admin, then make your change again. |
| The update did not work (red bar) | The previous version is still live. Open the link in the bar to see why, or ask the developer. Usually a field was left empty. |
| Forgot the PIN | Login screen > "Set this device up again" and enter the token again (or make a new one). |
| Phone lost or stolen | GitHub > Settings > Developer settings > Fine-grained tokens > **Delete** the token. The lost phone can no longer change anything. |
| Published something by mistake | GitHub repository > Commits > open the earlier commit > revert, or ask the developer. |
| Applications or reviews are not arriving | Check the form key in Settings, and the spam folder of the society email. |

## Good to know
- Hosting, the admin and the forms are all free. Limits: 250 form messages a month (Web3Forms free plan).
- Reviews are checked by the team before they show, because many visitors are under 18.
- Applicants are 13 to 25. The apply form asks them to confirm a parent or guardian knows if they are under 18.
- The PIN stops casual access on a shared device. The real protection is that the token only works for this one repository and can be deleted at any time.
