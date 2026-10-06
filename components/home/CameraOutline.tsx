import { VIEW_BOX } from "@/lib/camera/geometry";

/**
 * The traced outline, inlined.
 *
 * Inline rather than <img src>, for three reasons that all matter here: the
 * strokes have to be reachable to animate stroke-dashoffset, `currentColor`
 * has to resolve against the page, and the labels only render in the site's
 * mono face if they are real DOM text.
 *
 * Geometry is identical to assets/other/sony-a6700-outline.svg — the standalone
 * asset. Only the viewBox differs: that file is cropped tight to the shell,
 * while here it is widened to FRAME so the drawing shares a coordinate space
 * with the photograph, which has strap lugs sticking out past both sides.
 *
 * Two classes of element, distinguished for the entrance:
 *   data-draw   structural strokes; drawn on by dashoffset, in DOM order
 *   data-fade   fine detail (knurling, icons, labels); faded in, since dashing
 *               a path of 44 separate ticks reads as a glitch, not a drawing
 */
export function CameraOutline({ className }: { className?: string }) {
  return (
    <svg
      data-outline=""
      className={className}
      viewBox={VIEW_BOX}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* shell */}
      <g data-draw="" strokeWidth="3.6">
        <path d="M290 266H880C890 266 894 262 904 262H1192C1200 262 1204 269 1204 283H1234C1242 283 1247 300 1247 330V788C1247 806 1238 821 1218 821H300C280 821 269 807 269 789V290C269 275 276 266 290 266Z" />
      </g>

      {/* screen + hinge */}
      <g data-draw="" strokeWidth="2.6">
        <rect x="334" y="397" width="619" height="414" rx="11" />
        <rect x="412" y="436" width="511" height="349" rx="5" strokeWidth="2.2" />
      </g>
      <g data-draw="" strokeWidth="2.2">
        <path d="M271 397h63v421h-63" />
      </g>
      <g data-fade="" strokeWidth="1.6" opacity=".8">
        <path d="M274 540h60M274 546h60M274 675h60M274 681h60M274 797h60" />
      </g>

      {/* eyecup — open path: its top and left edges are the shell's own corner */}
      <g data-draw="" strokeWidth="2.8">
        <path d="M505 266v101c0 11-7 18-18 18H290c-11 0-19-7-19-18" />
        <rect x="286" y="281" width="207" height="96" rx="13" strokeWidth="2" />
        <rect x="321" y="288" width="124" height="83" rx="7" strokeWidth="2.2" />
        <rect x="464" y="313" width="21" height="47" rx="10" strokeWidth="2" />
      </g>
      <g data-fade="" strokeWidth="1.5" opacity=".55">
        <rect x="359" y="315" width="79" height="52" rx="4" />
      </g>

      {/* hot shoe */}
      <g data-draw="" strokeWidth="2.4">
        <rect x="534" y="267" width="172" height="46" rx="6" />
        <rect x="547" y="280" width="147" height="26" rx="4" strokeWidth="1.8" />
        <path d="M595 306h27v6h-27z" strokeWidth="1.5" />
      </g>
      <g data-fade="" strokeWidth="1.5" opacity=".6">
        <path d="M579 288h87" />
      </g>

      {/* panel seams */}
      <g data-draw="" strokeWidth="1.9" opacity=".75">
        <path d="M505 319h385c70 0 120 15 170 20l187 3" />
        <path d="M578 365h669" />
      </g>

      {/* top dials */}
      <g data-draw="" strokeWidth="2.6">
        <path d="M1012 265Q1072 240 1132 265" strokeWidth="2.2" />
        <rect x="887" y="263" width="143" height="50" rx="18" />
        <rect x="1063" y="262" width="133" height="50" rx="18" />
        <path d="M886 316c14 24 132 24 144 0" strokeWidth="2.2" />
        <path d="M1062 310c16 38 98 48 144 26" strokeWidth="2" opacity=".8" />
        <circle cx="540" cy="352" r="30" />
        <circle cx="540" cy="352" r="18" strokeWidth="1.8" />
      </g>
      <g data-fade="" strokeWidth="1.2" opacity=".7">
        <path d="M1030 264Q1072 249 1114 264" strokeWidth="1.6" opacity=".6" />
        <path d="M893 305h131" strokeWidth="1.5" opacity=".6" />
        <path d="M1069 303h121" strokeWidth="1.5" opacity=".6" />
        <path d="M905 269V302M912.65 269V302M920.3 269V302M927.95 269V302M935.6 269V302M943.25 269V302M950.9 269V302M958.55 269V302M966.2 269V302M973.85 269V302M981.5 269V302M989.15 269V302M996.8 269V302M1004.45 269V302" />
        <path d="M1081 268V300M1088.46 268V300M1095.92 268V300M1103.38 268V300M1110.84 268V300M1118.3 268V300M1125.76 268V300M1133.22 268V300M1140.68 268V300M1148.14 268V300M1155.6 268V300M1163.06 268V300M1170.52 268V300M1177.98 268V300" />
        <path d="M950 321V334M956.17 321V334M962.34 321V334M968.51 321V334M974.68 321V334M980.85 321V334M987.02 321V334M993.19 321V334M999.36 321V334M1005.53 321V334M1011.7 321V334M1017.87 321V334" />
        <path d="M560 352L568 352M559.19 357.63L566.87 359.89M556.83 362.81L563.56 367.14M553.1 367.11L558.34 373.16M548.31 370.19L551.63 377.47M542.85 371.8L543.98 379.72M537.15 371.8L536.02 379.72M531.69 370.19L528.37 377.47M526.9 367.11L521.66 373.16M523.17 362.81L516.44 367.14M520.81 357.63L513.13 359.89M520 352L512 352M520.81 346.37L513.13 344.11M523.17 341.19L516.44 336.86M526.9 336.89L521.66 330.84M531.69 333.81L528.37 326.53M537.15 332.2L536.02 324.28M542.85 332.2L543.98 324.28M548.31 333.81L551.63 326.53M553.1 336.89L558.34 330.84M556.83 341.19L563.56 336.86M559.19 346.37L566.87 344.11" />
        <circle cx="540" cy="352" r="38" strokeWidth="1.4" opacity=".45" />
      </g>

      {/* grip — a material boundary, not an edge, hence the lighter treatment */}
      <g data-fade="" strokeWidth="1.7" opacity=".5">
        <path d="M1247 378H1092c-18 0-24 10-24 28v122c0 24 16 38 44 48 44 16 72 40 78 80 6 44 8 92 10 136H1247Z" />
      </g>

      {/* control wheel */}
      <g data-draw="" strokeWidth="2.6">
        <circle cx="1076" cy="633" r="73" />
        <circle cx="1076" cy="633" r="44" strokeWidth="2" />
        <circle cx="1076" cy="633" r="30" strokeWidth="2.2" />
      </g>
      <g data-fade="" strokeWidth="1.2" opacity=".7">
        <path d="M1124 633L1145 633M1123.51 639.83L1144.3 642.82M1122.06 646.52L1142.21 652.44M1119.66 652.94L1138.76 661.66M1116.38 658.95L1134.05 670.3M1112.28 664.43L1128.15 678.19M1107.43 669.28L1121.19 685.15M1101.95 673.38L1113.3 691.05M1095.94 676.66L1104.66 695.76M1089.52 679.06L1095.44 699.21M1082.83 680.51L1085.82 701.3M1076 681L1076 702M1069.17 680.51L1066.18 701.3M1062.48 679.06L1056.56 699.21M1056.06 676.66L1047.34 695.76M1050.05 673.38L1038.7 691.05M1044.57 669.28L1030.81 685.15M1039.72 664.43L1023.85 678.19M1035.62 658.95L1017.95 670.3M1032.34 652.94L1013.24 661.66M1029.94 646.52L1009.79 652.44M1028.49 639.83L1007.7 642.82M1028 633L1007 633M1028.49 626.17L1007.7 623.18M1029.94 619.48L1009.79 613.56M1032.34 613.06L1013.24 604.34M1035.62 607.05L1017.95 595.7M1039.72 601.57L1023.85 587.81M1044.57 596.72L1030.81 580.85M1050.05 592.62L1038.7 574.95M1056.06 589.34L1047.34 570.24M1062.48 586.94L1056.56 566.79M1069.17 585.49L1066.18 564.7M1076 585L1076 564M1082.83 585.49L1085.82 564.7M1089.52 586.94L1095.44 566.79M1095.94 589.34L1104.66 570.24M1101.95 592.62L1113.3 574.95M1107.43 596.72L1121.19 580.85M1112.28 601.57L1128.15 587.81M1116.38 607.05L1134.05 595.7M1119.66 613.06L1138.76 604.34M1122.06 619.48L1142.21 613.56M1123.51 626.17L1144.3 623.18" />
      </g>

      {/* buttons — C1 is an arc because the shell's edge cuts it off */}
      <g data-draw="" strokeWidth="2.6">
        <rect x="749" y="330" width="85" height="20" rx="10" />
        <circle cx="1016" cy="413" r="35" />
        <circle cx="1017" cy="512" r="26" />
        <path d="M1247 397a22 22 0 0 0 0 42" />
        <circle cx="1048" cy="763" r="27" />
        <circle cx="1142" cy="763" r="26" />
      </g>

      {/* printed pictograms */}
      <g data-fade="" strokeWidth="1.7" opacity=".8">
        <circle cx="973" cy="381" r="8" />
        <path d="M979 387l7 7M969 381h8M973 377v8" />
        <path d="M971 463h13v18h-13M986 472h-14M977 466l-6 6 6 6" />
        <circle cx="985" cy="619" r="8" />
        <path d="M985 613v6l4 3M980 610l-3-3M990 610l3-3" />
        <path d="M978 641h13v13h-13zM983 638h13v13M988 635h13v13" />
        <path d="M1059 718h19v19h-19zM1063 725h6M1066 722v6M1070 733h6" />
        <path d="M1089 718h19v19h-19z" />
        <path
          d="M1089 718h9.5v9.5h-9.5zM1098.5 727.5h9.5v9.5h-9.5z"
          fill="currentColor"
          stroke="none"
        />
        <path d="M1035 752h26v22h-26z" />
        <path d="M1043 758l9 7-9 7z" fill="currentColor" stroke="none" />
        <path d="M1132 756h20v18h-20zM1129 752h26M1138 749h8" />
        <path d="M1137 760v9M1142 760v9M1147 760v9" strokeWidth="1.3" />
      </g>

      {/* printed labels */}
      <g
        data-fade=""
        fill="currentColor"
        stroke="none"
        fontFamily="var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight="700"
        textAnchor="middle"
      >
        <text x="791" y="345" fontSize="14" letterSpacing="0.5">
          MENU
        </text>
        <text x="1016" y="420" fontSize="19">
          AF-ON
        </text>
        <text x="1017" y="519" fontSize="18">
          Fn
        </text>
        <text x="1085" y="553" fontSize="19">
          DISP
        </text>
        <text x="1174" y="641" fontSize="19">
          ISO
        </text>
        <text x="1173" y="738" fontSize="19">
          C3
        </text>
      </g>
    </svg>
  );
}
