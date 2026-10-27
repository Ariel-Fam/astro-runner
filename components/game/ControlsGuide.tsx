import { Icon } from "./Icons";
const groups = [
  {
    title: "Find your footing",
    icon: "keyboard",
    controls: [
      ["W A S D / ↑ ← ↓ →", "Move relative to the camera"],
      ["SHIFT", "Hold to sprint"],
      ["SPACE", "Jump; press again in the air to double jump"],
      ["B", "Backflip from a platform"],
    ],
  },
  {
    title: "Hold your ground",
    icon: "compass",
    controls: [
      ["E", "Equip your weapon and stand still; movement and jumps pause"],
      ["MOUSE", "Click to capture; move to aim, or drag to look"],
      ["LMB / F", "Hold to fire while your weapon is equipped"],
      [
        "R",
        "Lower your weapon to move again; unarmed, return to your checkpoint",
      ],
      ["SCROLL / ESC", "Adjust camera distance / pause the game"],
    ],
  },
];
export default function ControlsGuide() {
  return (
    <section className="controls-guide" aria-labelledby="controls-title">
      <div className="controls-heading">
        <div>
          <span className="eyebrow">RUNNER FIELD GUIDE</span>
          <h2 id="controls-title">Know your next move.</h2>
        </div>
        <p>
          Aim with intention. Move between volleys.
          <br />
          Desktop keyboard and mouse recommended.
        </p>
      </div>
      <div className="controls-grid">
        {groups.map((group) => (
          <article className="controls-card" key={group.title}>
            <Icon name={group.icon} size={24} />
            <h3>{group.title}</h3>
            <dl>
              {group.controls.map(([key, action]) => (
                <div key={key}>
                  <dt>
                    <kbd>{key}</kbd>
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
        <article className="controls-card survival-card">
          <Icon name="flag" size={24} />
          <h3>Make the run count.</h3>
          <ul>
            <li>
              <strong>Break through.</strong> Three hits remove a ship’s force
              field. A fourth destroys the ship. Rooftops block enemy fire.
            </li>
            <li>
              <strong>Take the purple detour.</strong> Reach an amethyst above a
              small bounce pad for 22.2 seconds of laser immunity. Watch the
              purple countdown. A purple-ringed guardian patrols the remaining
              gems; three other ships fly wider routes across the district.
            </li>
            <li>
              <strong>Follow the markers.</strong> Text and arrows mark
              checkpoints that restore health. The final checkpoint has the
              large ARK 11 ship.
            </li>
            <li>
              <strong>Collect and survive.</strong> Octahedrons award 100 points
              each. Falling below the rooftops or losing all health ends the
              run; choose Restart to try again.
            </li>
            <li>
              <strong>Set your sound.</strong> Open Sound Mix to mute or adjust
              music and effects separately. Your levels are saved.
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}
