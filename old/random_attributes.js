function randomize_attributes() {
    console.log("hi");
    var l = ['videographer', 'artist', 'waluigi fan',
             'jokester', 'zoomer', 'failure', 'success',
             'human', 'bad dancer', 'programmer',
             'lizard-person', 'student', 'simulation',
             'robot', 'musician', 'pioneer',
             'neural network', 'comp sci student',
             
             ];
    
    // document.getElementById('banner-list').innerHTML = pick4(l);
    var h = pick4(l);
    document.getElementById('banner-list').innerHTML = toBrList(h);
    //var bannercss = findKeyframesRule('banimate-hide');
    // setTrailingNVisibility(h, bannercss);
    setTrailingNVisibility(h);
}

function pick4(l) {
    var out = [];
    for (var _ = 0; _ < 4; _++) {
        var i = Math.floor(Math.random()*l.length)
        out.push(l.splice(i, 1)[0]);
    }
    return out;
}

function toBrList(l) {
    var out = '';
    for (var i = 0; i < l.length; i++) {
        out += l[i] + '<br>';
    }
    return out;
}

function contains(l, d) {
    // console.log('testing ' + d)
    for (var i = 0; i < l.length; i++) {
        // console.log('against ' + l[i]);
        if (l[i] === d) return true;
    }
    // console.log(d + ' is not a vowel\n');
    return false;
}

function findKeyframesRule(rule) {
    var ss = document.styleSheets;
    for (var i = 0; i < ss.length; ++i) {
        for (var j = 0; j < ss[i].cssRules.length; ++j) {
            if (ss[i].cssRules[j].name == rule) { 
            return ss[i].cssRules[j]; }
        }
    }
    return null;
}

function setTrailingNVisibility(words) {
    console.log(words);
    for (var i = 0; i < words.length; i++) {
        if (contains(['a','e','i','o','u'], words[i][0])) {
            console.log(document.getElementById('banner-hide-anim').style);
            document.getElementById('banner-hide-anim').style.animationName = 'banimate-hide-n' + (i+1);
            // document.getElementById('banner-hide-anim').style.animation = 'banimate-hide-n' + i + ' 4s infinite alternate;';
            console.log(document.getElementById('banner-hide-anim').style);
        }
    }
}

randomize_attributes();