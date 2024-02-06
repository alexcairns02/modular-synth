import { modules, output } from './stores.js';

let mods, out;

modules.subscribe((value) => {
    mods = value;
});
output.subscribe((value) => {
    out = value;
});

export function createNewId() {
    for (let i=0; i<Object.keys(mods).length+1; i++) {
        if (!mods[i]) return i;
    }
}

export function destroyModule(module) {
    module.component.parentNode.removeChild(module.component);
    delete mods[module.state.id];
    if (out.state.inputId == module.state.id) out.state.inputId = null;
    Object.values(mods).forEach((m) => {
        if (m.state.inputId && m.state.inputId == module.state.id) {
            m.state.inputId = null;
            m.update();
        }
        if (m.state.cvId && m.state.cvId == module.state.id) {
            m.state.cvId = null;
            m.update();
        }
        if (m.state.type == 'mixer') {
            m.state.inputIds.forEach((inputId) => {
                if (inputId == module.state.id) inputId = null;
            });
            m.update();
        }
    });
};

export function inputsAllHover(module) {
    Object.values(mods).forEach((m) => {
        if (!m.output && m.state.id != module.state.id) {
            m.fade();
        }
    });
}

export function cvsAllHover(module) {
    Object.values(mods).forEach((m) => {
        if (!(m.state.type == 'lfo' || m.state.type == 'adsr') && m.state.id != module.state.id) {
            m.fade();
        }
    });
}

export function unhover() {
    Object.values(mods).forEach((m) => {
        m.unfade();
    });
}