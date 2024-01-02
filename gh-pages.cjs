var ghpages = require('gh-pages');

ghpages.publish(
    'public', // path to public directory
    {
        branch: 'gh-pages',
        repo: 'https://github.com/alexcairns02/modular-synth', // Update to point to your repository  
        user: {
            name: 'alexcairns02', // update to use your name
            email: 'ac1198@exeter.ac.uk' // Update to use your email
        }
    },
    () => {
        console.log('Deploy Complete!')
    }
)