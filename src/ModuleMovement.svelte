
<script>
    import { spring } from 'svelte/motion';


    export let moduleNode;
    export let controlsNode;
    export let deleteNode;
    export let nodeSize = { x: 300, y: 300 };
    export let nodePos = { x: 300, y: 100 };

    let coords = spring({ x: nodePos.x, y: nodePos.y}, {
        stiffness: 0.3,
        damping: 0.5
    });
    let size = spring(0, {
        stiffness: 0.3,
        damping: 0.5
    });

    let moving = false;
    let controlling = false;

    $: if (moduleNode) {
        moduleNode.addEventListener('mousedown', () => {
            moving = true;
            if (!controlling) size.set(20);
        });
        moduleNode.addEventListener('touchstart', () => {
            moving = true;
            if (!controlling) size.set(20);
        });
    }

    $: if (controlsNode) {
        controlsNode.addEventListener('mousedown', () => { controlling = true });
        controlsNode.addEventListener('touchstart', () => { controlling = true });
    }
    $: if (deleteNode) {
        deleteNode.addEventListener('mousedown', () => { controlling = true });
        deleteNode.addEventListener('touchstart', () => { controlling = true });
    }

    window.addEventListener('mouseup', () => { moving = false; controlling = false; size.set(0); });
    window.addEventListener('touchend', () => { moving = false; controlling = false; size.set(0); });

    window.addEventListener('mousemove', (e) => {
        if (moving && !controlling) {
            nodePos.x += e.movementX;
            nodePos.y += e.movementY;
            coords.set({ x: nodePos.x, y: nodePos.y });
        }
    });
    window.addEventListener('touchmove', (e) => {
        if (moving && !controlling) {
            nodePos.x += e.movementX;
            nodePos.y += e.movementY;
            coords.set({ x: nodePos.x, y: nodePos.y });
        }
    });

    $: if (moduleNode) {
        moduleNode.style.left = `${$coords.x-$size/2}px`;
        moduleNode.style.top = `${$coords.y-$size/2}px`;
        moduleNode.style.width = `${nodeSize.x+$size}px`;
        moduleNode.style.height = `${nodeSize.y+$size}px`;
    }
</script>