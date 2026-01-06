import React from 'react';

export default function SocietyObjectives() {
    return (
        <div className="flex flex-col gap-4 border-l-4 border-trophy-gold pl-6 py-2">
            <span className="text-trophy-gold font-bold uppercase tracking-widest text-sm">Our Constitution</span>
            <h1 className="text-5xl md:text-6xl font-serif font-black leading-tight text-jaguar-green">
                Society Objectives
            </h1>
            <ul className="flex flex-col gap-3 text-midnight-navy text-lg font-medium max-w-4xl leading-relaxed mt-2">
                <li className="flex gap-3">
                    <span className="text-trophy-gold font-bold">•</span>
                    To organise and promote the game of golf under the R&A rules, as far as possible.
                </li>
                <li className="flex gap-3">
                    <span className="text-trophy-gold font-bold">•</span>
                    To hold as many golf events as possible for the members and guests during the golf season between April and October each year.
                </li>
                <li className="flex gap-3">
                    <span className="text-trophy-gold font-bold">•</span>
                    To assist the Charity Committee in the organisation of the Annual Jaguar Charity Day.
                </li>
                <li className="flex gap-3">
                    <span className="text-trophy-gold font-bold">•</span>
                    To organise the Radha Cup weekend according to Appendix 3.
                </li>
                <li className="flex gap-3">
                    <span className="text-trophy-gold font-bold">•</span>
                    To organise Club monthly stapleford format, Singles and Doubles knockout competition plus any other golf events or functions as decided by the Management Committee.
                </li>
                <li className="flex gap-3">
                    <span className="text-trophy-gold font-bold">•</span>
                    To encourage players of all abilities including young members and beginners to participate in the game of Golf.
                </li>
                <li className="flex gap-3">
                    <span className="text-trophy-gold font-bold">•</span>
                    To raise standards of game, knowledge & etiquette.
                </li>
            </ul>
        </div>
    );
}
