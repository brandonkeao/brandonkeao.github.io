#!/usr/bin/env node

/**
 * Download book covers from Open Library API
 * Run: node scripts/download-covers.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const COVERS_DIR = path.join(__dirname, '../public/images/books');

// All books from bookshelf
const books = [
  // Product Management & Strategy
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
  { title: "Sprint", author: "Jake Knapp" },
  { title: "The Innovator's Dilemma", author: "Clayton Christensen" },
  { title: "Loved", author: "Martina Lauchengco" },
  { title: "Transformed", author: "Marty Cagan" },
  { title: "Sense and Respond", author: "Jeff Gothelf" },
  { title: "Product-Led Growth", author: "Wes Bush" },

  // Leadership & Organizations
  { title: "Good to Great", author: "Jim Collins" },
  { title: "Great by Choice", author: "Jim Collins" },
  { title: "Good Strategy Bad Strategy", author: "Richard Rumelt" },
  { title: "The Hard Thing About Hard Things", author: "Ben Horowitz" },
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

  // Thinking & Decision Making
  { title: "Thinking in Bets", author: "Annie Duke" },
  { title: "Range", author: "David Epstein" },
  { title: "The Scout Mindset", author: "Julia Galef" },
  { title: "Superforecasting", author: "Philip Tetlock" },
  { title: "Tools of Titans", author: "Tim Ferriss" },

  // Design & Innovation
  { title: "Change by Design", author: "Tim Brown" },
  { title: "The Design of Everyday Things", author: "Don Norman" },
  { title: "Org Design for Design Orgs", author: "Peter Merholz" },
  { title: "Solving Problems with Design Thinking", author: "Jeanne Liedtka" },

  // Communication & Sales
  { title: "Never Split the Difference", author: "Chris Voss" },
  { title: "Getting to Yes", author: "Roger Fisher" },
  { title: "Nonviolent Communication", author: "Marshall Rosenberg" },
  { title: "The Challenger Sale", author: "Matthew Dixon" },
  { title: "Predictable Revenue", author: "Aaron Ross" },
  { title: "Give and Take", author: "Adam Grant" },

  // Technology & Business
  { title: "Platform Revolution", author: "Geoffrey Parker" },
  { title: "The Third Wave", author: "Steve Case" },
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

// Search Open Library for a book and get cover ID
function searchBook(title, author) {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(`${title} ${author}`);
    const url = `https://openlibrary.org/search.json?q=${query}&limit=1`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.docs && json.docs.length > 0) {
            const doc = json.docs[0];
            // Try cover_i first, then isbn
            if (doc.cover_i) {
              resolve({ type: 'id', value: doc.cover_i });
            } else if (doc.isbn && doc.isbn.length > 0) {
              resolve({ type: 'isbn', value: doc.isbn[0] });
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Download cover image
function downloadCover(coverInfo, filename) {
  return new Promise((resolve, reject) => {
    let url;
    if (coverInfo.type === 'id') {
      url = `https://covers.openlibrary.org/b/id/${coverInfo.value}-L.jpg`;
    } else {
      url = `https://covers.openlibrary.org/b/isbn/${coverInfo.value}-L.jpg`;
    }

    const filepath = path.join(COVERS_DIR, filename);
    const file = fs.createWriteStream(filepath);

    https.get(url, (res) => {
      // Follow redirect
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, (res2) => {
          res2.pipe(file);
          file.on('finish', () => {
            file.close();
            // Check if file is valid (not a 1x1 placeholder)
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
      } else {
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
      }
    }).on('error', (e) => {
      fs.unlink(filepath, () => {});
      reject(e);
    });
  });
}

// Main function
async function main() {
  // Ensure directory exists
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }

  console.log(`Downloading covers for ${books.length} books...\n`);

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
      const coverInfo = await searchBook(book.title, book.author);

      if (coverInfo) {
        const downloaded = await downloadCover(coverInfo, filename);
        if (downloaded) {
          console.log('✓');
          success++;
        } else {
          console.log('✗ (no cover available)');
          failed.push(book.title);
        }
      } else {
        console.log('✗ (not found)');
        failed.push(book.title);
      }
    } catch (e) {
      console.log(`✗ (error: ${e.message})`);
      failed.push(book.title);
    }

    // Rate limit - be nice to the API
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n--- Summary ---`);
  console.log(`Downloaded: ${success}/${books.length}`);

  if (failed.length > 0) {
    console.log(`\nFailed (${failed.length}):`);
    failed.forEach(t => console.log(`  - ${t}`));
    console.log('\nFor failed books, manually download covers from Amazon or publisher sites.');
  }
}

main().catch(console.error);
