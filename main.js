// Load the dataset
d3.csv("CGMacros_glucose.csv").then(function (data) {
    // Convert data types
    data.forEach(d => {
        d.Timestamp = new Date(d.Timestamp);
        d["Libre GL"] = +d["Libre GL"];
    });

    // Get unique participants for dropdown
    let participants = [...new Set(data.map(d => d.Participant_ID))];

    // Populate dropdown
    let dropdown = d3.select("#participantDropdown");
    dropdown.selectAll("option")
        .data(participants)
        .enter()
        .append("option")
        .text(d => d);

    // Set up chart dimensions
    const svg = d3.select("#glucoseChart"),
          width = +svg.attr("width"),
          height = +svg.attr("height"),
          margin = { top: 20, right: 50, bottom: 50, left: 70 };

    const xScale = d3.scaleTime().range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().range([height - margin.bottom, margin.top]);

    const xAxis = svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`);
    const yAxis = svg.append("g").attr("transform", `translate(${margin.left},0)`);
    
    const line = d3.line()
        .x(d => xScale(d.Timestamp))
        .y(d => yScale(d["Libre GL"]));

    const tooltip = d3.select(".tooltip");

    // Function to update chart based on selected participant
    function updateChart(participant) {
        let filteredData = data.filter(d => d.Participant_ID === participant);

        // Update scales
        xScale.domain(d3.extent(filteredData, d => d.Timestamp));
        yScale.domain([d3.min(filteredData, d => d["Libre GL"]) - 10, d3.max(filteredData, d => d["Libre GL"]) + 10]);

        // Update axes
        xAxis.call(d3.axisBottom(xScale).ticks(5));
        yAxis.call(d3.axisLeft(yScale));

        // Bind data to line path
        const path = svg.selectAll(".line").data([filteredData]);

        // Enter + Update
        path.enter()
            .append("path")
            .attr("class", "line")
            .merge(path)
            .transition()
            .duration(500)
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .attr("stroke-width", 2)
            .attr("d", line);

        // Bind data to circles for hover effect
        const circles = svg.selectAll("circle").data(filteredData);

        circles.enter()
            .append("circle")
            .merge(circles)
            .transition()
            .duration(500)
            .attr("cx", d => xScale(d.Timestamp))
            .attr("cy", d => yScale(d["Libre GL"]))
            .attr("r", 4)
            .attr("fill", "red");

        // Add hover tooltip
        circles.on("mouseover", (event, d) => {
            tooltip.style("display", "block")
                .style("left", event.pageX + "px")
                .style("top", event.pageY - 30 + "px")
                .html(`Time: ${d.Timestamp.toLocaleTimeString()}<br>Glucose: ${d["Libre GL"]} mg/dL`);
        }).on("mouseout", () => {
            tooltip.style("display", "none");
        });

        // Remove old points
        circles.exit().remove();
    }

    // Initialize with the first participant
    updateChart(participants[0]);

    // Update chart when dropdown changes
    dropdown.on("change", function() {
        updateChart(this.value);
    });

});
