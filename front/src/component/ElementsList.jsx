import React from 'react';
import { prettify } from '../helpers/debug.js';



const ElementsList = ({ schemaElements, libElements, selected, hovered }) => {



    return (
        <React.Fragment>

            {Object.values(schemaElements).map((e) => {
                return <div key={e.id} className='elements-list'>
                    {libElements[e.typeId] ? (libElements[e.typeId].abbr + e.typeIndex) : `Lib error, no ID ${e.typeId}`}
                </div>

            })


            }

            {prettify(selected)}<br />
            {prettify(hovered)}<br />
        </React.Fragment>



    );
};
export default ElementsList;

// <div id="control_panel">
// </div>