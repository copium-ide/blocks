// Matter.js (not this file, this: https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js) is licensed under MIT. See here: https://github.com/liabru/matter-js
export const main = {
    info: {
        author: `copium-ide`,
        namespace: `matter`,
        name: `Matter.js (Self-Contained)`,
        version: `1.1.0`,
        email: ``,
        website: `https://github.com/copium-ide`,
        description: `A self-contained Matter.js extension. It automatically injects the Matter.js library and creates a canvas element on the page for rendering.`
    },
    init: function() {
        // This generated code will be run once when the project starts.
        return `
// --- Self-Contained Matter.js Setup ---

// This function contains all the logic for setting up the physics world.
// It will be called only after we're sure Matter.js is loaded.
function initializeMatterWorld() {
    console.log('Matter.js is loaded. Initializing world...');

    // 1. Find or create the rendering element
    let matterContainer = document.getElementById('copium-matter-canvas');
    if (!matterContainer) {
        matterContainer = document.createElement('div');
        matterContainer.id = 'copium-matter-canvas';
        // Add some basic styling to make it visible
        matterContainer.style.border = '1px solid #aaa';
        matterContainer.style.margin = '10px auto'; // Center it
        matterContainer.style.overflow = 'hidden'; // Hide overflowing canvas
        document.body.appendChild(matterContainer);
    }

    // 2. Create the core Matter.js components
    const engine = await Matter.Engine.create();
    const world = engine.world;
    const render = Matter.Render.create({
        element: matterContainer,
        engine: engine,
        options: {
            width: 800,
            height: 600,
            wireframes: false, // Set to false to see textures from links
            background: '#f0f0f0'
        }
    });
    const runner = Matter.Runner.create();

    // 3. Run the simulation
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);

    // 4. Store components in the environment for other blocks to access
    Copium.env.matter = {
        engine: engine,
        world: world,
        render: render,
        runner: runner,
        bodies: {} // A place to store named bodies
    };
}

// This IIFE (Immediately Invoked Function Expression) checks if Matter.js
// is already on the page. If not, it injects it from a CDN.
(function() {
    if (window.Matter) {
        // If Matter is already available, initialize immediately.
        initializeMatterWorld();
    } else {
        // If not, create a script tag to load it from a CDN.
        console.log('Matter.js not found. Injecting from CDN...');
        const script = document.createElement('script');
        // Use a specific version for stability
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';
        
        // The magic part: The initialization runs only after the script has loaded.
        script.onload = initializeMatterWorld;
        
        script.onerror = () => {
            console.error('Failed to load Matter.js library from the CDN.');
        };
        document.head.appendChild(script);
    }
})();`;
    },
    
    blocks: {
        createBox: {
            text: `create box %name at x:%x y:%y size w:%w h:%h with options:%options`,
            description: `Creates a rectangular physics body. Use options to set properties or a visual sprite. Example options with image link: { isStatic: true, render: { sprite: { texture: 'https://place-hold.it/50x50/ff0000' } } }`,
            generate: function(args) {
                return `
if (Copium.env.matter) {
    const box = Matter.Bodies.rectangle(${args.x}, ${args.y}, ${args.w}, ${args.h}, ${args.options});
    Copium.env.matter.bodies['${args.name}'] = box;
    Matter.World.add(Copium.env.matter.world, box);
} else {
    console.warn('Matter.js environment not ready. Could not create box.');
}`
            },
            inputs: {
                name: `String`,
                x: `Number`,
                y: `Number`,
                w: `Number`,
                h: `Number`,
                options: `Object`
            }
        },

        createCircle: {
            text: `create circle %name at x:%x y:%y with radius:%r with options:%options`,
            description: `Creates a circular physics body. Use options to set properties or a visual sprite. Example options with image link: { render: { sprite: { texture: 'https://place-hold.it/50/00ff00' } } }`,
            generate: function(args) {
                return `
if (Copium.env.matter) {
    const circle = Matter.Bodies.circle(${args.x}, ${args.y}, ${args.r}, ${args.options});
    Copium.env.matter.bodies['${args.name}'] = circle;
    Matter.World.add(Copium.env.matter.world, circle);
} else {
    console.warn('Matter.js environment not ready. Could not create circle.');
}`
            },
            inputs: {
                name: `String`,
                x: `Number`,
                y: `Number`,
                r: `Number`,
                options: `Object`
            }
        },

        createWalls: {
            text: `create walls for canvas width:%w height:%h`,
            description: `Creates static walls (floor, ceiling, left, right) for the scene.`,
            generate: function(args) {
                return `
if (Copium.env.matter) {
    const ground = Matter.Bodies.rectangle(${args.w} / 2, ${args.h} + 29, ${args.w}, 60, { isStatic: true });
    const ceiling = Matter.Bodies.rectangle(${args.w} / 2, -29, ${args.w}, 60, { isStatic: true });
    const leftWall = Matter.Bodies.rectangle(-29, ${args.h} / 2, 60, ${args.h}, { isStatic: true });
    const rightWall = Matter.Bodies.rectangle(${args.w} + 29, ${args.h} / 2, 60, ${args.h}, { isStatic: true });
    Matter.World.add(Copium.env.matter.world, [ground, ceiling, leftWall, rightWall]);
} else {
    console.warn('Matter.js environment not ready. Could not create walls.');
}`
            },
            inputs: {
                w: `Number`,
                h: `Number`
            }
        },

        applyForce: {
            text: `apply force to %name with force vector x:%fx y:%fy`,
            description: `Applies a force to a body from its center of mass.`,
            generate: function(args) {
                return `
if (Copium.env.matter && Copium.env.matter.bodies['${args.name}']) {
    Matter.Body.applyForce(
        Copium.env.matter.bodies['${args.name}'], 
        Copium.env.matter.bodies['${args.name}'].position, 
        { x: ${args.fx}, y: ${args.fy} }
    );
}`;
            },
            inputs: {
                name: `String`,
                fx: `Number`,
                fy: `Number`
            }
        },

        setGravity: {
            text: `set world gravity to x:%x y:%y`,
            description: `Sets the global gravity for the physics world. (Default is y:1).`,
            generate: function(args) {
                return `
if (Copium.env.matter) {
    Copium.env.matter.engine.gravity.x = ${args.x};
    Copium.env.matter.engine.gravity.y = ${args.y};
}`;
            },
            inputs: {
                x: `Number`,
                y: `Number`
            }
        }
    }
};
