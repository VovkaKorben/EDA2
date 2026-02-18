import React from 'react';


const buttonsCodes = [


    { id: 1, caption: 'Load', ico: 'open' },
    { id: 5, caption: 'Save', ico: 'save' },

    { id: 20, caption: 'Clear all', ico: 'clear_all' },
    { id: 21, caption: 'Clear wires', ico: 'clear_wires' },

    { id: 3, caption: 'Reset view', ico: 'view' },
    { id: 4, caption: 'Route', ico: 'route' },
     { id: 400, caption: 'log', ico: '' }
]

const ControlButton = ({ text, onClick, ico }) => {
    return (
        <div
            onClick={onClick}
            className="control-button frcc">
            {ico && <img src={`./${ico}.svg`} />}
            {text}
        </div>
    );
}

const Controls = ({ onAction }) => {
    return (
        <React.Fragment>

            {buttonsCodes.map((e) => {
                return <ControlButton
                    key={e.id}
                    text={e.caption}
                    ico={e.ico}
                    onClick={() => onAction(e.id)}

                />

            })


            }
        </React.Fragment>



    );
};
export default Controls;

// <div id="control_panel">
// </div>