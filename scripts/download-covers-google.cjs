#!/usr/bin/env node

/**
 * Download book covers from Google Books API
 * Run: node scripts/download-covers-google.cjs
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const COVERS_DIR = path.join(__dirname, '../public/images/books');

// Books that need covers (failed from Open Library)
const books = [
  { title: "Inspired", author: "Marty Cagan" },
  { title: "Empowered", author: "Marty Cagan" },
  { title: "Continuous Discovery Habits", author: "Teresa Torres" },
  { title: "Escaping the Build Trap", author: "Melissa Perri" },
  { title: "Working Backwards", author: "Colin Bryar" },
  { title: "User Story Mapping", author: "Jeff Patton" },
  { title: "Competing Against Luck", author: "Clayton Christensen" },
  { title: "Hooked", author: "Nir Eyal" },
  { title: "Obviously Awesome", author: "April Dunford" },
  { title: "Product Roadmaps Relaunched", author: "C. Todd Lombardo" },
  { title: "Zero to One", author: "Peter Thiel" },
  { title: "Traction", author: "Gabriel Weinberg" },
  { title: "The Lean Startup", author: "Eric Ries" },
  { title: "The Innovator's Dilemma", author: "Clayton Christensen" },
  { title: "Loved", author: "Martina Lauchengco" },
  { title: "Transformed", author: "Marty Cagan" },
  { title: "Sense and Respond", author: "Jeff Gothelf" },
  { title: "Product-Led Growth", author: "Wes Bush" },
  { title: "Good to Great", author: "Jim Collins" },
  { title: "Great by Choice", author: "Jim Collins" },
  { title: "Good Strategy Bad Strategy", author: "Richard Rumelt" },
  { title: "High Output Management", author: "Andy Grove" },
  { title: "Team Topologies", author: "Matthew Skelton" },
  { title: "The Five Dysfunctions of a Team", author: "Patrick Lencioni" },
  { title: "An Elegant Puzzle", author: "Will Larson" },
  { title: "Dare to Lead", author: "Brené Brown" },
  { title: "Extreme Ownership", author: "Jocko Willink" },
  { title: "The Dichotomy of Leadership", author: "Jocko Willink" },
  { title: "No Rules Rules", author: "Reed Hastings" },
  { title: "The Culture Code", author: "Daniel Coyle" },
  { title: "The Outsiders", author: "William Thorndike" },
  { title: "Brave New Work", author: "Aaron Dignan" },
  { title: "Build", author: "Tony Fadell" },
  { title: "Masters of Scale", author: "Reid Hoffman" },
  { title: "Leadership in Turbulent Times", author: "Doris Kearns Goodwin" },
  { title: "Thinking in Bets", author: "Annie Duke" },
  { title: "Range", author: "David Epstein" },
  { title: "The Scout Mindset", author: "Julia Galef" },
  { title: "Superforecasting", author: "Philip Tetlock" },
  { title: "Tools of Titans", author: "Tim Ferriss" },
  { title: "Change by Design", author: "Tim Brown" },
  { title: "The Design of Everyday Things", author: "Don Norman" },
  { title: "Org Design for Design Orgs", author: "Peter Merholz" },
  { title: "Solving Problems with Design Thinking", author: "Jeanne Liedtka" },
  { title: "Never Split the Difference", author: "Chris Voss" },
  { title: "Getting to Yes", author: "Roger Fisher" },
  { title: "Nonviolent Communication", author: "Marshall Rosenberg" },
  { title: "Platform Revolution", author: "Geoffrey Parker" },
  { title: "Power and Prediction", author: "Ajay Agrawal" },
  { title: "Rework", author: "Jason Fried" },
  { title: "Let My People Go Surfing", author: "Yvon Chouinard" }
];

// Generate filename from title
function toFilename(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') + '.jpg';
}

// Fetch JSON from URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Download file from URL
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    // Handle http vs https
    const protocol = url.startsWith('https') ? https : require('http');

    const makeRequest = (url) => {
      protocol.get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          makeRequest(res.headers.location);
          return;
        }

        const file = fs.createWriteStream(filepath);
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          const stats = fs.statSync(filepath);
          if (stats.size < 1000) {
            fs.unlinkSync(filepath);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      }).on('error', (e) => {
        fs.unlink(filepath, () => {});
        reject(e);
      });
    };

    makeRequest(url);
  });
}

// Search Google Books and get cover URL
async function getGoogleBooksCover(title, author) {
  const query = encodeURIComponent(`${title} ${author}`);
  const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`;

  try {
    const data = await fetchJson(url);

    if (data.items && data.items.length > 0) {
      const imageLinks = data.items[0].volumeInfo?.imageLinks;
      if (imageLinks) {
        // Prefer larger images, convert to zoom=1 for better quality
        let coverUrl = imageLinks.thumbnail || imageLinks.smallThumbnail;
        if (coverUrl) {
          // Get larger version by changing zoom parameter
          coverUrl = coverUrl.replace('zoom=1', 'zoom=2').replace('&edge=curl', '');
          // Convert http to https
          coverUrl = coverUrl.replace('http://', 'https://');
          return coverUrl;
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Main function
async function main() {
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }

  console.log(`Downloading covers for ${books.length} books from Google Books...\n`);

  let success = 0;
  let failed = [];

  for (const book of books) {
    const filename = toFilename(book.title);
    const filepath = path.join(COVERS_DIR, filename);

    // Skip if already exists
    if (fs.existsSync(filepath)) {
      console.log(`✓ ${book.title} (already exists)`);
      success++;
      continue;
    }

    process.stdout.write(`  ${book.title}... `);

    try {
      const coverUrl = await getGoogleBooksCover(book.title, book.author);

      if (coverUrl) {
        const downloaded = await downloadFile(coverUrl, filepath);
        if (downloaded) {
          console.log('✓');
          success++;
        } else {
          console.log('✗ (invalid image)');
          failed.push(book.title);
        }
      } else {
        console.log('✗ (no cover found)');
        failed.push(book.title);
      }
    } catch (e) {
      console.log(`✗ (error: ${e.message})`);
      failed.push(book.title);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n--- Summary ---`);
  console.log(`Downloaded: ${success}/${books.length}`);

  if (failed.length > 0) {
    console.log(`\nFailed (${failed.length}):`);
    failed.forEach(t => console.log(`  - ${t}`));
  }
}

main().catch(console.error);
