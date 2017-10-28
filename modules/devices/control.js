/**
 * @fileoverview Base class for all generic controls
 * @author <a href="mailto:Jeff@pcjs.org">Jeff Parsons</a>
 * @copyright © Jeff Parsons 2012-2017
 *
 * This file is part of PCjs, a computer emulation software project at <http://pcjs.org/>.
 *
 * PCjs is free software: you can redistribute it and/or modify it under the terms of the
 * GNU General Public License as published by the Free Software Foundation, either version 3
 * of the License, or (at your option) any later version.
 *
 * PCjs is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with PCjs.  If not,
 * see <http://www.gnu.org/licenses/gpl.html>.
 *
 * You are required to include the above copyright notice in every modified copy of this work
 * and to display that copyright notice when the software starts running; see COPYRIGHT in
 * <http://pcjs.org/modules/shared/lib/defines.js>.
 *
 * Some PCjs files also attempt to load external resource files, such as character-image files,
 * ROM files, and disk image files. Those external resource files are not considered part of PCjs
 * for purposes of the GNU General Public License, and the author does not claim any copyright
 * as to their contents.
 */

"use strict";

var DEBUG = true;

class Control {
    /**
     * Control()
     *
     * Supported config properties:
     *
     *      "bindings": object containing name/value pairs, where name is the generic name
     *      of a element, and value is the ID of the DOM element that should be mapped to it
     *
     * The properties in the "bindings" object are copied to our own bindings object in addBindings(),
     * but only for DOM elements that actually exist, and it is the elements themselves (rather than their IDs)
     * that we store.
     *
     * @this {Control}
     * @param {string} idMachine
     * @param {string} [idControl]
     * @param {Object} [config]
     */
    constructor(idMachine, idControl, config)
    {
        this.config = config || {};
        this.idMachine = idMachine;
        this.idControl = idControl || idMachine;
        this.printCategory = "";
        this.addControl();
        this.addBindings();
    }

    /**
     * addBinding(binding, element)
     *
     * @this {Control}
     * @param {string} binding
     * @param {HTMLElement} element
     */
    addBinding(binding, element)
    {
        switch(binding) {
        case Control.BINDING.PRINT:
            if (!this.bindings[binding]) {
                let elementTextArea = /** @type {HTMLTextAreaElement} */ (element);
                this.bindings[binding] = elementTextArea;
                /*
                 * This was added for Firefox (Safari will clear the <textarea> on a page reload, but Firefox does not).
                 */
                elementTextArea.value = "";
            }
            break;
        }
    }

    /**
     * addBindings()
     *
     * @this {Control}
     */
    addBindings()
    {
        this.bindings = {};
        let bindings = this.config['bindings'];
        for (let binding in bindings) {
            let id = bindings[binding];
            let element = document.getElementById(id);
            if (element) {
                this.addBinding(binding, element);
            }
        }
    }

    /**
     * addControl()
     *
     * @this {Control}
     */
    addControl()
    {
        if (!Control.machines[this.idMachine]) Control.machines[this.idMachine] = [];
        Control.machines[this.idMachine].push(this);
    }

    /**
     * assert(f, s)
     *
     * Verifies conditions that must be true (for DEBUG builds only).
     *
     * The Closure Compiler should automatically remove all references to assert() in non-DEBUG builds.
     * TODO: Add a task to the build process that "asserts" there are no instances of "assertion failure" in RELEASE builds.
     *
     * @param {boolean} f is the expression we are asserting to be true
     * @param {string} [s] is description of the assertion on failure
     */
    assert(f, s)
    {
        if (DEBUG) {
            if (!f) {
                if (!s) s = "assertion failure";
                this.println(s);
                throw new Error(s);
            }
        }
    }

    /**
     * findBinding(name, fAll)
     *
     * This will search the current control's bindings, and optionally all the control bindings within the
     * machine.  If the binding is found in another control, that binding is recorded in this control as well.
     *
     * @this {Control}
     * @param {string} name
     * @param {boolean} [fAll]
     * @return {HTMLElement|null|undefined}
     */
    findBinding(name, fAll = false)
    {
        let element = this.bindings[name];
        if (element === undefined && fAll) {
            let controls = Control.machines[this.idMachine];
            for (let i in controls) {
                element = controls[i].bindings[name];
                if (element) break;
            }
            if (!element) element = null;
            this.bindings[name] = element;
        }
        return element;
    }

    /**
     * print(s, category)
     *
     * Both print() and println() support an optional category parameter, which if set, should be one
     * of the values defined in Control.CATEGORY, and will suppress the print operation if the specified
     * category isn't an active category.
     *
     * @this {Control}
     * @param {string} s
     * @param {string} [category]
     */
    print(s, category)
    {
        if (!category || !this.printCategory || this.printCategory.indexOf(category) >= 0) {
            let element = this.findBinding(Control.BINDING.PRINT, true);
            if (element) {
                element.value += s;
                /*
                 * Prevent the <textarea> from getting too large; otherwise, printing becomes slower and slower.
                 */
                if (element.value.length > 8192) element.value = element.value.substr(element.value.length - 4096);
                element.scrollTop = element.scrollHeight;
            }
            else {
                let i = s.lastIndexOf('\n');
                if (i >= 0) {
                    console.log(Control.printBuffer + s.substr(0, i));
                    Control.printBuffer = "";
                    s = s.substr(i + 1);
                }
                Control.printBuffer += s;
            }
        }
    }

    /**
     * println(s, category)
     *
     * @this {Control}
     * @param {string} s
     * @param {string} [category]
     */
    println(s, category)
    {
        this.print(s + '\n', category);
    }

    /**
     * printf(format, ...args)
     *
     * @this {Control}
     * @param {string} format
     * @param {...} args
     */
    printf(format, ...args)
    {
        this.print(this.sprintf(format, args));
    }

    /**
     * sprintf(format, ...args)
     *
     * Copied from the CCjs project (/ccjs/lib/stdio.js) and extended.  Far from complete let alone sprintf-compatible,
     * but it's a start.
     *
     * @this {Control}
     * @param {string} format
     * @param {...} args
     * @return {string}
     */
    sprintf(format, ...args)
    {
        let parts = format.split(/%([-+ 0#]?)([0-9]*)(\.?)([0-9]*)([hlL]?)([A-Za-z%])/);
        let buffer = "";
        let partIndex = 0;
        for (let i = 0; i < args.length; i++) {

            let arg = args[i], d, s;
            buffer += parts[partIndex++];
            let flags = parts[partIndex];
            let minimum = +parts[partIndex+1] || 0;
            let precision = +parts[partIndex+3] || 0;
            let conversion = parts[partIndex+5];

            switch(conversion) {
            case 'd':
            case 'f':
                d = Math.trunc(arg);
                s = d + "";
                if (precision) {
                    minimum -= (precision + 1);
                }
                if (s.length < minimum) {
                    if (flags == '0') {
                        if (d < 0) minimum--;
                        s = ("0000000000" + Math.abs(d)).slice(-minimum);
                        if (d < 0) s = '-' + s;
                    } else {
                        s = ("          " + s).slice(-minimum);
                    }
                }
                if (precision) {
                    d = Math.trunc((arg - Math.trunc(arg)) * Math.pow(10, precision));
                    s += '.' + ("0000000000" + Math.abs(d)).slice(-precision);
                }
                buffer += s;
                break;
            case 's':
                buffer += arg;
                break;
            default:
                /*
                 * The supported ANSI C set of conversions: "dioxXucsfeEgGpn%"
                 */
                buffer += "(unrecognized printf conversion %" + conversion + ")";
                break;
            }

            partIndex += 6;
        }
        buffer += parts[partIndex];
        return buffer;
    }

    /**
     * updateBindingText(name, text)
     *
     * @this {Control}
     * @param {string} name
     * @param {string} text
     */
    updateBindingText(name, text)
    {
        let element = this.bindings[name];
        if (element) element.textContent = text;
    }
}

Control.BINDING = {
    PRINT:  "print"
};

Control.CATEGORY = {
    TIME:   "time"
};

/**
 * machines is an Object whose properties are machine IDs and whose values are arrays of Controls.
 *
 * @type {Object}
 */
Control.machines = {};

/**
 * @type {string}
 */
Control.printBuffer = "";
