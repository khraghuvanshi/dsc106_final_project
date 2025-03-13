const svg = d3.select("glucoseChart");
const width = +svg.attr("width");
const height = +svg.attr("height");

// Cluster positions
const clusters = {
    "Healthy": { x: width * 0.25, y: height * 0.5 }, 
    "Pre-diabetic": { x: width * 0.5, y: height * 0.5 }, 
    "Diabetic": { x: width * 0.75, y: height * 0.5 } 
};


// Color scale for categories
const colorScale = d3.scaleThreshold()
    .domain([10, 25]) // Pre-diabetic, Diabetic
    .range(["green", "orange", "red"]); // Healthy, Pre-diabetic, Diabetic

// Tooltip setup
const tooltip = d3.select("body").append("div")
    .style("position", "absolute")
    .style("background", "lightgray")
    .style("padding", "5px")
    .style("border-radius", "5px")
    .style("visibility", "hidden");

d3.json("data.json").then(data => {
    // Normalize keys and remove trailing spaces
    data = data.map(d => ({
        subject: d.subject,
        carbs: d.Carbs,
        protein: d.Protein,
        fat: d.Fat,
        fiber: d.Fiber,
        insulin: d["Insulin "] // Fix trailing space issue
    }));

    // Assign category
    data.forEach(d => {
        if (d.insulin > 25) d.category = "Diabetic";
        else if (d.insulin > 10) d.category = "Pre-diabetic";
        else d.category = "Healthy";
    });

    const clusterCenters = {
        "Healthy": { x: width * 0.35, y: height / 2 },
        "Pre-diabetic": { x: width * 0.5, y: height / 2 },
        "Diabetic": { x: width * 0.65, y: height / 2 }
    };

    // Force simulation
    // const centerX = width / 2;
    // const centerY = height / 2;

    const simulation = d3.forceSimulation(data)
        .force("center", d3.forceCenter(width / 2, height / 2)) // Center of the SVG
        .force("charge", d3.forceManyBody().strength(-5)) // Soft repulsion to avoid excessive spread
        .force("x", d3.forceX(d => clusterCenters[d.category].x).strength(0.3)) // Move to cluster center
        .force("y", d3.forceY(d => clusterCenters[d.category].y).strength(0.3)) // Keep groups aligned
        .force("collide", d3.forceCollide(12)) // Prevent overlap, ensure separation
        // .force("charge", d3.forceManyBody().strength(-5)) // Soft repulsion to avoid excessive spread
        .alpha(1)  
        .alphaDecay(0.05)  
        .on("tick", ticked);

    // const simulation = d3.forceSimulation(data)
    //     .force("x", d3.forceX(d => clusters[d.category].x).strength(0.5))
    //     .force("y", d3.forceY(d => clusters[d.category].y).strength(0.5))
    //     .force("collide", d3.forceCollide(12))
    //     .on("tick", ticked);

    // Draw bubbles
    const bubbles = svg.selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("r", 12)
        .attr("fill", d => colorScale(d.insulin))
        .style("opacity", 0.8)
        .on("mouseover", (event, d) => {
            tooltip.style("visibility", "visible")
                .html(`Carbs: ${d.carbs}g <br> Protein: ${d.protein}g <br> Fat: ${d.fat}g <br> Fiber: ${d.fiber}g <br> Insulin: ${d.insulin}`);
        })
        .on("mousemove", (event) => {
            tooltip.style("top", (event.pageY - 10) + "px")
                .style("left", (event.pageX + 10) + "px");
        })
        .on("mouseout", () => tooltip.style("visibility", "hidden"));

    function ticked() {
        d3.selectAll("circle")
        .attr("cx", d => Math.max(20, Math.min(width - 20, d.x))) // Keep inside width
        .attr("cy", d => Math.max(20, Math.min(height - 20, d.y))); // Keep inside height
        // bubbles.attr("cx", d => d.x)
        //        .attr("cy", d => d.y);
    }

    // Add new user data point
    window.addUserData = function () {
        let carbs = +document.getElementById("carbs").value;
        let protein = +document.getElementById("protein").value;
        let fat = +document.getElementById("fat").value;
        let fiber = +document.getElementById("fiber").value;

        // Compute insulin prediction (Example formula)
        let insulinLevel = (carbs * 0.2) + (protein * 0.1) + (fat * 0.15) - (fiber * 0.05);

        let category = "Healthy";
        if (insulinLevel > 25) category = "Diabetic";
        else if (insulinLevel > 10) category = "Pre-diabetic";

        let newUser = { carbs, protein, fat, fiber, insulin: insulinLevel, category, isUserInput: true };

        data.push(newUser);
        simulation.nodes(data);

        let newBubble = svg.append("circle")
            .attr("cx", width / 2)
            .attr("cy", height / 2)
            .attr("r", 12)
            .attr("fill", "blue")  // Blue for user input
            .style("opacity", 1)
            .on("mouseover", (event) => {
                tooltip.style("visibility", "visible")
                    .html(`Carbs: ${carbs}g <br> Protein: ${protein}g <br> Fat: ${fat}g <br> Fiber: ${fiber}g <br> Insulin: ${insulinLevel.toFixed(2)}`);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", () => tooltip.style("visibility", "hidden"));

        // Add category label next to the new bubble
        let label = svg.append("text")
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("fill", "black")
            .text(category);

        // Update simulation to include the new point
        simulation.nodes(data);
        simulation.alpha(0.1).alphaDecay(0.02).restart();
        simulation.alphaMin(0.05); // Stops simulation sooner


        simulation.on("tick", () => {
            newBubble.attr("cx", newUser.x).attr("cy", newUser.y);
            label.attr("x", newUser.x + 15).attr("y", newUser.y); // Position text slightly right of the dot
        });
    };
});
