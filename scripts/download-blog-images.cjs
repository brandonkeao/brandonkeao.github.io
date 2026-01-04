#!/usr/bin/env node

/**
 * Download blog images from Squarespace
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '../public/images/blog');

const images = [
  // Level 5 Product Leadership
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590811220834-151WVWIOXHJC1KMBJ24O/1.+Five-levels_eng-1-1024x675+copy.jpg', file: 'five-levels-leadership.jpg' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590811010815-90N39VJAF8J5K285LUMB/4-laws-of-combat-2.png', file: '4-laws-of-combat.png' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590811052312-W07EU5J78RE96SBZ1DY0/mindsets-for-victory.png', file: 'mindsets-for-victory.png' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590810912596-THM1ZS871CGHCMKW90T6/mirror-window-2.jpg', file: 'mirror-window.jpg' },

  // Good to Great Product Management
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1589392503584-82GCYZRBMEZCFUJBEI2F/good%2Bto%2Bgreat.jpg', file: 'good-to-great-book.jpg' },

  // Outcomes over Outputs
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1589037689677-QFDYMY0U0JQKE6V4JWJE/escaping-the-build-trap+%281%29.jpg', file: 'escaping-the-build-trap-book.jpg' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1589038196192-PDSWSXHQYKCYQIZ6BLB0/pm+ocean+2.jpg', file: 'pm-ocean.jpg' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1589038499463-K8IRJJVUEBD49FHB7V47/product+kata.png', file: 'product-kata.png' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1589038352408-HIXU370WXDHE0K18T02W/flywheel-1.jpg', file: 'flywheel.jpg' },

  // A Quest for Shared Understanding
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590719801780-8SMNIWKGH0G16XH40NMZ/user-story-mapping+%281%29.png', file: 'user-story-mapping-book.png' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590722370313-KHEABEY6CDAA42J563ZZ/Vaca.png', file: 'vaca.png' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590720333417-X7HFEK8KPLVGE3QLQLUQ/user-story-mapping-example.jpg', file: 'user-story-mapping-example.jpg' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590722089024-P7Z32OOJNUK4N43R0AWN/Opportunity+Format.png', file: 'opportunity-format.png' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590774837946-YUSDG1CBWNRSREY0YVWG/RICE-2.jpg', file: 'rice-framework.jpg' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590775065506-PTCPU7YAB2XRW2MY080K/user-story-mapping-framework.png', file: 'user-story-mapping-framework.png' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590721343077-IQY866V2MF8OSS699XCC/Achieving+Outcomes.png', file: 'achieving-outcomes.png' },

  // Discipline of Thought, Discipline of Action
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590032497846-DVUV422YSNJ0Y48BEYM4/Hedgehog-Concept.png', file: 'hedgehog-concept.png' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590033004504-VZ9RNF6C18QXAWXYBJDY/vp-product.jpg', file: 'vp-product-comic.jpg' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1590033192796-9YIBCHUDKAIMM19ZK6PK/James_Stockdale_Formal_Portrait+%282%29.jpg', file: 'james-stockdale.jpg' },

  // The Hard Thing About Hard Things
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1588810906806-QCFKDZJVQVIPONL403PT/Hard%2BThings.jpg', file: 'hard-things-book.jpg' },

  // Retros, Rumbles, and Trust
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1588644932396-8JKUYT1X9L8N76179OY4/dare-to-lead+%281%29.jpg', file: 'dare-to-lead-book.jpg' },

  // Product Management Origin Stories
  { url: 'http://static1.squarespace.com/static/5d04fa04e62d0e00018bcc17/5d0882f877d42b000118e53a/5d08847977d42b000118f3a7/1561070941198/StockSnap_8ZB9C03AIJ.jpg?format=1500w', file: 'pm-origin-stories.jpg' },

  // What makes a Product Manager
  { url: 'http://static1.squarespace.com/static/5d04fa04e62d0e00018bcc17/5d0882f877d42b000118e53a/5d08830d8b38ee00019e57ce/1560839245158/What-is-Product-Management-2.jpeg?format=1500w', file: 'what-is-product-management.jpg' },

  // One Word Annual Resolutions
  { url: 'http://static1.squarespace.com/static/5d04fa04e62d0e00018bcc17/5d0882f877d42b000118e53a/5d0b0c170ead130001ead8e2/1561005403054/One-Word.jpeg?format=1500w', file: 'one-word.jpg' },

  // 3 Principles of Technology Vendor Management
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1589996289605-7K8FEBRM0VMIGW2ET157/vendor-management.jpg', file: 'vendor-management.jpg' },

  // Bitcoin: The Internet of Money
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1561071044286-WH8N3BNS8ODKVA1NH203/BitTorrent-e1438701034561.jpg', file: 'bittorrent-diagram.jpg' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1561071104734-3G5Z331YSHYIG9S9F6JR/Bitcoin-e1438700994230.jpg', file: 'bitcoin-diagram.jpg' },

  // GoPro: Powered by UGC
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1561070690642-G6NWLYJ0F5E9GC2H2QF3/Beatriz_2.jpg', file: 'beatriz-gopro.jpg' },

  // SpaceX: Explosive Innovation
  { url: 'http://static1.squarespace.com/static/5d04fa04e62d0e00018bcc17/5d0882f877d42b000118e53a/5d0c0a68ddee9c00011a82bb/1561231373424/rocket-lift-off-2.jpg?format=1500w', file: 'spacex-rocket.jpg' },

  // Inbox Zero
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1561005699214-W325QVPPGA7T8BOMOE2D/HannahInbox.png', file: 'hannah-inbox.png' },
  { url: 'https://images.squarespace-cdn.com/content/v1/5d04fa04e62d0e00018bcc17/1561005735019-EOLBFBPAG163OC0C6YVK/BrandonInbox.png', file: 'brandon-inbox.png' },

  // Crashing at the Speed of Light
  { url: 'http://static1.squarespace.com/static/5d04fa04e62d0e00018bcc17/5d0882f877d42b000118e53a/5d0c1d0e6f8b6a000121ff77/1561231039120/NYSE-v3.jpg?format=1500w', file: 'nyse.jpg' },

  // Sales Scripts, Arm Yourself
  { url: 'http://static1.squarespace.com/static/5d04fa04e62d0e00018bcc17/5d0882f877d42b000118e53a/5d0b0b2f62219600017e734a/1561005025078/bow-578768.png?format=1500w', file: 'sales-bow.png' },
];

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(IMAGES_DIR, filename);

    if (fs.existsSync(filepath)) {
      console.log('SKIP ' + filename + ' (exists)');
      resolve(true);
      return;
    }

    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(filepath);
        downloadFile(res.headers.location, filename).then(resolve).catch(reject);
        return;
      }

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(filepath);
        console.log('OK ' + filename + ' (' + Math.round(stats.size/1024) + 'KB)');
        resolve(true);
      });
    }).on('error', (e) => {
      fs.unlink(filepath, () => {});
      console.log('FAIL ' + filename + ' (' + e.message + ')');
      resolve(false);
    });
  });
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  console.log('Downloading ' + images.length + ' blog images...\n');

  let success = 0;
  let failed = [];

  for (const img of images) {
    const ok = await downloadFile(img.url, img.file);
    if (ok) success++;
    else failed.push(img.file);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n--- Summary ---');
  console.log('Downloaded: ' + success + '/' + images.length);

  if (failed.length > 0) {
    console.log('\nFailed:');
    failed.forEach(f => console.log('  - ' + f));
  }
}

main().catch(console.error);
