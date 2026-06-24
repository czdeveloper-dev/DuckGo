using System;
using System.Collections.Generic;
class Program {
    static void TestMain() {
        try {
            var l = new List<string>();
            var x = l[Random.Shared.Next(l.Count)];
        } catch(Exception e) {
            Console.WriteLine(e.Message);
            Console.WriteLine("Param: " + ((ArgumentException)e).ParamName);
        }
    }
}
